const { withTransaction } = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const users = require('../users/users.model');
const departments = require('../departments/departments.model');
const notifications = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');
const {
  hashPassword,
  verifyPassword,
  signToken,
  signAccessToken,
  issueAuthTokens,
  setRefreshCookie,
  clearRefreshCookie,
} = require('./auth.service');
const tokenModel = require('./token.model');
const oauthService = require('./oauth.service');

// POST /api/auth/register
async function register(req, res) {
  const body = req.valid.body;

  if (!(await departments.findById(body.deptId))) {
    throw ApiError.badRequest('Validation failed', [{ location: 'body', field: 'deptId', message: 'Department does not exist' }]);
  }
  if (await users.findByEmail(body.email)) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(body.password);

  // User + profile + tags are written together: either all succeed or nothing is saved.
  const userId = await withTransaction(async (client) => {
    const newId = await users.createUser(client, { ...body, passwordHash });
    if (body.role === 'ALUMNI') await users.createAlumniProfile(client, newId, body);
    else await users.createStudentProfile(client, newId, body);
    if (body.skills) await users.setTags(client, 'skills', newId, body.skills);
    if (body.interests) await users.setTags(client, 'interests', newId, body.interests);
    if (body.role === 'ALUMNI') {
      await notifications.notifyRole(
        'ADMIN',
        { type: 'ALUMNI_PENDING', title: `${body.fullName} registered and is awaiting verification`, linkUrl: '#/admin' },
        client
      );
    }
    return newId;
  });

  await audit.log({ actorId: userId, action: 'REGISTER', entityName: 'users', entityId: userId, ip: req.ip });

  const user = await users.findById(userId);
  const tokenBundle = await issueAuthTokens(user, { res });

  res.status(201).json({
    data: {
      token: tokenBundle.token,
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      user: await users.getFullProfile(userId),
    },
  });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await users.findByEmail(email);
  const passwordOk = await verifyPassword(password, user?.password_hash);

  if (!user || !passwordOk) {
    let locked = false;
    if (user && user.account_status === 'ACTIVE') {
      const result = await users.recordLoginFailure(user.user_id);
      locked = result.account_status === 'SUSPENDED';
    }
    await audit.log({
      actorId: user?.user_id,
      action: locked ? 'ACCOUNT_LOCKED' : 'LOGIN',
      entityName: 'users',
      entityId: user?.user_id,
      outcome: 'FAILURE',
      errorCode: user ? 'BAD_PASSWORD' : 'UNKNOWN_EMAIL',
      ip: req.ip,
    });
    if (locked) {
      throw ApiError.forbidden(`Account locked after ${users.MAX_FAILED_LOGINS} failed attempts. Contact an administrator.`);
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.account_status !== 'ACTIVE') {
    await audit.log({
      actorId: user.user_id,
      action: 'LOGIN',
      entityName: 'users',
      entityId: user.user_id,
      outcome: 'FAILURE',
      errorCode: `ACCOUNT_${user.account_status}`,
      ip: req.ip,
    });
    throw ApiError.forbidden(`Account is ${user.account_status.toLowerCase()}. Contact an administrator.`);
  }

  await users.recordLoginSuccess(user.user_id);
  await audit.log({ actorId: user.user_id, action: 'LOGIN', entityName: 'users', entityId: user.user_id, ip: req.ip });

  const tokenBundle = await issueAuthTokens(user, { res });

  res.json({
    data: {
      token: tokenBundle.token,
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      user: await users.getFullProfile(user.user_id),
    },
  });
}

// POST /api/auth/refresh (Lecture 16 Slide 13, 14, 15)
// Rotates the refresh token, detects replay attacks, and issues new Access Token
async function refresh(req, res) {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!rawToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  const result = await tokenModel.rotateRefreshToken(rawToken);

  if (result.status === 'REUSE_DETECTED') {
    // Lecture 16 Slide 15: "An old token appears again? Revoke its token family and require login."
    await audit.log({
      actorId: result.userId,
      action: 'TOKEN_REUSE_DETECTED',
      entityName: 'refresh_token',
      outcome: 'FAILURE',
      errorCode: 'REPLAY_ATTACK',
      ip: req.ip,
    });
    clearRefreshCookie(res);
    throw ApiError.forbidden('Security alert: Refresh token reuse detected. All sessions revoked. Please log in again.');
  }

  if (result.status === 'EXPIRED' || result.status === 'INVALID_TOKEN' || result.status === 'REVOKED') {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Invalid or expired refresh token. Please sign in again.');
  }

  if (result.status === 'USER_INACTIVE') {
    clearRefreshCookie(res);
    throw ApiError.forbidden(`Account is ${result.accountStatus?.toLowerCase() || 'inactive'}.`);
  }

  // Success: issue new access token and set rotated refresh token cookie
  const newAccessToken = signAccessToken(result.user);
  setRefreshCookie(res, result.newRawToken);

  res.json({
    data: {
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: result.newRawToken,
      user: result.user,
    },
  });
}

// POST /api/auth/logout (Lecture 16 Slide 16)
// Safe logout: revokes server-side refresh token and clears client cookie
async function logout(req, res) {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (rawToken) {
    await tokenModel.revokeRefreshToken(rawToken);
  }

  if (req.user?.id) {
    await audit.log({
      actorId: req.user.id,
      action: 'LOGOUT',
      entityName: 'users',
      entityId: req.user.id,
      ip: req.ip,
    });
  }

  clearRefreshCookie(res);

  res.json({
    data: {
      message: 'Logged out successfully',
    },
  });
}

// POST /api/auth/oauth/google (Lecture 16 Slide 17-21)
// Direct OAuth 2.0 / OIDC identity verification and sign-in
async function googleAuth(req, res) {
  const { idToken, code, role = 'ALUMNI', deptId } = req.valid.body;

  // 1. Google proves identity (OIDC)
  const identity = await oauthService.verifyGoogleIdentity({ idToken, code });

  // 2. Look up existing user by Google ID or Email
  let user = (await users.findByGoogleId(identity.googleId)) || (await users.findByEmail(identity.email));

  if (user) {
    // Existing user: link Google ID if not yet linked
    if (!user.google_id) {
      await users.linkGoogleId(user.user_id, identity.googleId, identity.avatarUrl);
    }

    if (user.account_status !== 'ACTIVE') {
      await audit.log({
        actorId: user.user_id,
        action: 'LOGIN_GOOGLE',
        entityName: 'users',
        entityId: user.user_id,
        outcome: 'FAILURE',
        errorCode: `ACCOUNT_${user.account_status}`,
        ip: req.ip,
      });
      throw ApiError.forbidden(`Account is ${user.account_status.toLowerCase()}. Contact an administrator.`);
    }

    await users.recordLoginSuccess(user.user_id);
    await audit.log({
      actorId: user.user_id,
      action: 'LOGIN_GOOGLE',
      entityName: 'users',
      entityId: user.user_id,
      ip: req.ip,
    });

    const tokenBundle = await issueAuthTokens(user, { res });
    return res.json({
      data: {
        token: tokenBundle.token,
        accessToken: tokenBundle.accessToken,
        refreshToken: tokenBundle.refreshToken,
        user: await users.getFullProfile(user.user_id),
      },
    });
  }

  // 3. New User via Google OAuth
  // Lecture 16 Slide 21: "Google proves identity; your app decides access and assigns roles."
  const assignedRole = role === 'ADMIN' ? 'ALUMNI' : role; // Non-admin self-registration restriction
  const selectedDeptId = deptId || 1; // Fallback to first department

  const userId = await withTransaction(async (client) => {
    const newId = await users.createUserWithOAuth(client, {
      email: identity.email,
      fullName: identity.fullName,
      googleId: identity.googleId,
      role: assignedRole,
      avatarUrl: identity.avatarUrl,
    });

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const enrollmentNo = req.valid.body.enrollmentNo || `G-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    if (assignedRole === 'ALUMNI') {
      await users.createAlumniProfile(client, newId, {
        deptId: selectedDeptId,
        enrollmentNo,
        degree: req.valid.body.degree || 'B.Tech',
        graduationYear: req.valid.body.graduationYear || new Date().getFullYear(),
        photoUrl: identity.avatarUrl,
      });

      await notifications.notifyRole(
        'ADMIN',
        {
          type: 'ALUMNI_PENDING',
          title: `${identity.fullName} signed up via Google and is awaiting verification`,
          linkUrl: '#/admin',
        },
        client
      );
    } else {
      await users.createStudentProfile(client, newId, {
        deptId: selectedDeptId,
        enrollmentNo,
        currentSemester: req.valid.body.currentSemester || 1,
        expectedGradYear: req.valid.body.expectedGradYear || new Date().getFullYear() + 4,
      });
    }

    return newId;
  });

  await audit.log({
    actorId: userId,
    action: 'REGISTER_GOOGLE',
    entityName: 'users',
    entityId: userId,
    ip: req.ip,
  });

  const newUser = await users.findById(userId);
  const tokenBundle = await issueAuthTokens(newUser, { res });

  res.status(201).json({
    data: {
      token: tokenBundle.token,
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      user: await users.getFullProfile(userId),
    },
  });
}

// GET /api/auth/oauth/google (URL Generator)
function googleRedirect(req, res) {
  const url = oauthService.getGoogleAuthUrl({
    state: req.query.state,
    redirectUri: req.query.redirectUri,
  });
  if (req.query.format === 'json') {
    return res.json({ data: { url } });
  }
  res.redirect(url);
}

// GET /api/auth/oauth/google/callback
async function googleCallback(req, res) {
  const { code } = req.query;
  if (!code) {
    throw ApiError.badRequest('Authorization code missing from Google redirect callback');
  }

  const identity = await oauthService.verifyGoogleIdentity({ code });
  let user = (await users.findByGoogleId(identity.googleId)) || (await users.findByEmail(identity.email));

  if (!user) {
    // Redirect to frontend registration flow with pre-filled Google info
    const redirectUrl = `/#/auth?mode=register&email=${encodeURIComponent(identity.email)}&name=${encodeURIComponent(identity.fullName)}&googleId=${encodeURIComponent(identity.googleId)}`;
    return res.redirect(redirectUrl);
  }

  const tokenBundle = await issueAuthTokens(user, { res });
  res.redirect(`/#/?token=${encodeURIComponent(tokenBundle.token)}`);
}

// PATCH /api/auth/password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await users.findById(req.user.id);

  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    throw ApiError.badRequest('Validation failed', [{ location: 'body', field: 'currentPassword', message: 'Current password is incorrect' }]);
  }

  await users.updatePassword(user.user_id, await hashPassword(newPassword));
  // Safe logout / invalidate all refresh tokens on password change (Lecture 16 Slide 16)
  await tokenModel.revokeAllUserTokens(user.user_id);
  await audit.log({ actorId: user.user_id, action: 'PASSWORD_CHANGE', entityName: 'users', entityId: user.user_id, ip: req.ip });
  res.json({ data: { message: 'Password updated. All other active sessions have been signed out.' } });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  googleAuth,
  googleRedirect,
  googleCallback,
  changePassword,
};
