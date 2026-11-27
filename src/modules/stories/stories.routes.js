const { Router } = require('express');
const { authenticate, optionalAuth, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { idParam } = require('../../utils/validators');
const {
  createStorySchema,
  updateStorySchema,
  reviewStorySchema,
  listStoriesQuerySchema
} = require('./stories.schemas');
const controller = require('./stories.controller');

const router = Router();

// Public / Authenticated story discovery
router.get('/', optionalAuth, validate({ query: listStoriesQuerySchema }), controller.listStories);
router.get('/my', authenticate, validate({ query: listStoriesQuerySchema }), controller.getMyStories);
router.get('/:id', optionalAuth, validate({ params: idParam }), controller.getStoryById);

// Alumni/Admin story submissions & edits
router.post('/', authenticate, authorize('ALUMNI', 'ADMIN'), validate({ body: createStorySchema }), controller.createStory);
router.patch('/:id', authenticate, validate({ params: idParam, body: updateStorySchema }), controller.updateStory);
router.delete('/:id', authenticate, validate({ params: idParam }), controller.deleteStory);

// Admin review / moderation
router.patch('/:id/review', authenticate, authorize('ADMIN'), validate({ params: idParam, body: reviewStorySchema }), controller.reviewStory);

module.exports = router;
