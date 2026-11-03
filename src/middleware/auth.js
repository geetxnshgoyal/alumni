const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

// Verifies the "Authorization: Bearer <token>" header and attaches the current user to req.user.
// The user is re-loaded from the database so suspended accounts or changed roles take effect immediately.
async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  const { rows } = await query(
    'SELECT user_id, email, full_name, role, account_status FROM users WHERE user_id = $1',
    [payload.sub]
  );
  const user = rows[0];
  if (!user) return next(ApiError.unauthorized('Account no longer exists'));
  if (user.account_status !== 'ACTIVE') return next(ApiError.forbidden('Account is not active'));

  req.user = { id: user.user_id, email: user.email, fullName: user.full_name, role: user.role };
  next();
}

// Use after authenticate: authorize('ADMIN') allows only admins, authorize('ADMIN', 'ALUMNI') allows both.
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

module.exports = { authenticate, authorize };
