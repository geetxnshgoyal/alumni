const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const {
  createFeedbackSchema,
  adminUpdateFeedbackSchema,
  listFeedbackQuerySchema
} = require('./feedback.schemas');
const controller = require('./feedback.controller');

const router = Router();

// User feedback submission & status lookup
router.post('/', authenticate, validate({ body: createFeedbackSchema }), controller.submitFeedback);
router.get('/my', authenticate, validate({ query: listFeedbackQuerySchema }), controller.getMyFeedback);
router.get('/:id', authenticate, controller.getFeedbackById);

// Admin feedback moderation & responses
router.get('/', authenticate, authorize('ADMIN'), validate({ query: listFeedbackQuerySchema }), controller.listFeedback);
router.patch('/:id', authenticate, authorize('ADMIN'), validate({ body: adminUpdateFeedbackSchema }), controller.updateFeedback);

module.exports = router;
