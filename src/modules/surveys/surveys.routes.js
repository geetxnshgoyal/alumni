const { Router } = require('express');
const { authenticate, optionalAuth, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { idParam } = require('../../utils/validators');
const {
  createSurveySchema,
  submitResponseSchema,
  updateSurveyStatusSchema,
  listSurveysQuerySchema
} = require('./surveys.schemas');
const controller = require('./surveys.controller');

const router = Router();

// Public / Authenticated survey discovery
router.get('/', optionalAuth, validate({ query: listSurveysQuerySchema }), controller.listSurveys);
router.get('/:id', optionalAuth, validate({ params: idParam }), controller.getSurveyById);
router.get('/:id/my-response', authenticate, validate({ params: idParam }), controller.getMyResponse);
router.get('/:id/results', authenticate, authorize('ADMIN'), validate({ params: idParam }), controller.getSurveyResults);

// Admin survey creation and status update
router.post('/', authenticate, authorize('ADMIN'), validate({ body: createSurveySchema }), controller.createSurvey);
router.patch('/:id/status', authenticate, authorize('ADMIN'), validate({ params: idParam, body: updateSurveyStatusSchema }), controller.updateSurveyStatus);

// User response submission
router.post('/:id/responses', authenticate, validate({ params: idParam, body: submitResponseSchema }), controller.submitResponse);

module.exports = router;
