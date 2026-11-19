const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');
const schemas = require('./auth.schemas');
const controller = require('./auth.controller');

const router = Router();

// Standard credentials auth
router.post('/register', authLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);
router.patch('/password', authenticate, validate({ body: schemas.changePassword }), controller.changePassword);

// Modern Token Architecture (Lecture 16 Slide 13-16)
router.post('/refresh', controller.refresh);
router.post('/logout', optionalAuth, controller.logout);

// OAuth 2.0 & OpenID Connect (Google Login) (Lecture 16 Slide 17-21)
router.post('/oauth/google', validate({ body: schemas.googleAuth }), controller.googleAuth);
router.get('/oauth/google', controller.googleRedirect);
router.get('/oauth/google/callback', controller.googleCallback);

module.exports = router;
