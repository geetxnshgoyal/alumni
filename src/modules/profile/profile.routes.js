const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./profile.schemas');
const controller = require('./profile.controller');

const router = Router();

router.get('/profile/me', authenticate, controller.getMe);
router.patch('/profile/me', authenticate, validate({ body: schemas.updateProfile }), controller.updateMe);

router.get('/skills', authenticate, validate({ query: schemas.searchTags }), controller.getSkills);
router.get('/interests', authenticate, validate({ query: schemas.searchTags }), controller.getInterests);

module.exports = router;
