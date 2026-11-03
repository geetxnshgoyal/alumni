const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');
const schemas = require('./auth.schemas');
const controller = require('./auth.controller');

const router = Router();

router.post('/register', authLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);
router.patch('/password', authenticate, validate({ body: schemas.changePassword }), controller.changePassword);

module.exports = router;
