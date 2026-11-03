const { withTransaction } = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const users = require('../users/users.model');
const departments = require('../departments/departments.model');
const notifications = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');
const { hashPassword, verifyPassword, signToken } = require('./auth.service');

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
  res.status(201).json({ data: { token: signToken(user), user: await users.getFullProfile(userId) } });
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
    await audit.log({ actorId: user.user_id, action: 'LOGIN', entityName: 'users', entityId: user.user_id, outcome: 'FAILURE', errorCode: `ACCOUNT_${user.account_status}`, ip: req.ip });
    throw ApiError.forbidden(`Account is ${user.account_status.toLowerCase()}. Contact an administrator.`);
  }

  await users.recordLoginSuccess(user.user_id);
  await audit.log({ actorId: user.user_id, action: 'LOGIN', entityName: 'users', entityId: user.user_id, ip: req.ip });

  res.json({ data: { token: signToken(user), user: await users.getFullProfile(user.user_id) } });
}

// PATCH /api/auth/password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await users.findById(req.user.id);

  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    throw ApiError.badRequest('Validation failed', [{ location: 'body', field: 'currentPassword', message: 'Current password is incorrect' }]);
  }

  await users.updatePassword(user.user_id, await hashPassword(newPassword));
  await audit.log({ actorId: user.user_id, action: 'PASSWORD_CHANGE', entityName: 'users', entityId: user.user_id, ip: req.ip });
  res.json({ data: { message: 'Password updated' } });
}

module.exports = { register, login, changePassword };
