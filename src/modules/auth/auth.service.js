const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const tokenModel = require('./token.model');

// Fewer hashing rounds in tests keeps the suite fast; production uses 12.
const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

// Compared against when an email is not found, so login takes the same time either way
// and attackers cannot tell which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);

const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash || DUMMY_HASH);

/**
 * Access Token: short-lived API pass (Lecture 16 Slide 9)
 * Used to access protected resources and APIs.
 */
const signAccessToken = (user) => {
  const userId = user.user_id || user.userId;
  return jwt.sign(
    { sub: userId, role: user.role, email: user.email, jti: crypto.randomUUID() },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN || env.JWT_EXPIRES_IN }
  );
};

// Backwards-compatible alias for existing callers
const signToken = signAccessToken;

const REFRESH_COOKIE_NAME = 'refreshToken';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
});

function setRefreshCookie(res, rawToken) {
  if (!res) return;
  res.cookie(REFRESH_COOKIE_NAME, rawToken, getCookieOptions());
}

function clearRefreshCookie(res) {
  if (!res) return;
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getCookieOptions(),
    maxAge: undefined,
  });
}

/**
 * Issues dual token pair: Short-lived Access Token + Secure Rotated Refresh Token.
 * Attaches HttpOnly cookie if response object is provided (Lecture 16 Slide 10-12).
 */
async function issueAuthTokens(user, { res = null, familyId = null } = {}) {
  const userId = user.user_id || user.userId;
  const accessToken = signAccessToken(user);
  const { rawToken, familyId: activeFamilyId, expiresAt } = await tokenModel.createRefreshToken({
    userId,
    familyId,
  });

  if (res) {
    setRefreshCookie(res, rawToken);
  }

  return {
    token: accessToken,
    accessToken,
    refreshToken: rawToken,
    familyId: activeFamilyId,
    expiresAt,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signToken,
  issueAuthTokens,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
};
