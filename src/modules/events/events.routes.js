const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const schemas = require('./events.schemas');
const controller = require('./events.controller');

const router = Router();
const adminOnly = [authenticate, authorize('ADMIN')];

// Events listing and viewing
router.get('/', optionalAuth, validate({ query: schemas.listQuery }), controller.list);
router.get('/registrations/me', authenticate, controller.myRegistrations);
router.get('/:id', optionalAuth, validate({ params: schemas.idParam }), controller.getById);

// Admin-managed events CRUD and cancellation
router.post('/', adminOnly, validate({ body: schemas.create }), controller.create);
router.patch('/:id', adminOnly, validate({ params: schemas.idParam, body: schemas.update }), controller.update);
router.patch('/:id/cancel', adminOnly, validate({ params: schemas.idParam }), controller.cancelEvent);
router.delete('/:id', adminOnly, validate({ params: schemas.idParam }), controller.remove);

// Registration & waitlist
router.post('/:id/register', authenticate, validate({ params: schemas.idParam }), controller.register);
router.delete('/:id/register', authenticate, validate({ params: schemas.idParam }), controller.cancelRegistration);
router.post('/:id/cancel-registration', authenticate, validate({ params: schemas.idParam }), controller.cancelRegistration);
router.get('/:id/registrations', adminOnly, validate({ params: schemas.idParam }), controller.listRegistrations);

module.exports = router;
