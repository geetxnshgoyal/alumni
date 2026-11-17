const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./jobs.schemas');
const controller = require('./jobs.controller');

const router = Router();

router.get('/me', authenticate, controller.listMyApplications);
router.get('/:id', authenticate, validate({ params: schemas.idParam }), controller.getApplicationById);
router.patch(
  '/:id/status',
  authenticate,
  validate({ params: schemas.idParam, body: schemas.updateApplicationStatus }),
  controller.updateApplicationStatus
);

module.exports = router;
