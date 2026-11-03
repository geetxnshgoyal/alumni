const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Slows down password guessing on login/register. Disabled in tests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res) =>
    res.status(429).json({ error: { message: 'Too many attempts, please try again in 15 minutes' } }),
});

module.exports = { authLimiter };
