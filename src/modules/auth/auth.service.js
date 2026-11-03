const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

// Fewer hashing rounds in tests keeps the suite fast; production uses 12.
const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

// Compared against when an email is not found, so login takes the same time either way
// and attackers cannot tell which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);

const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash || DUMMY_HASH);

const signToken = (user) =>
  jwt.sign({ sub: user.user_id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

module.exports = { hashPassword, verifyPassword, signToken };
