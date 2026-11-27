const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { idParam } = require('../../utils/validators');
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
router.get('/:id', authenticate, validate({ params: idParam }), controller.getFeedbackById);

// Admin feedback moderation & responses
router.get('/', authenticate, authorize('ADMIN'), validate({ query: listFeedbackQuerySchema }), controller.listFeedback);
router.patch('/:id', authenticate, authorize('ADMIN'), validate({ params: idParam, body: adminUpdateFeedbackSchema }), controller.updateFeedback);

module.exports = router;
