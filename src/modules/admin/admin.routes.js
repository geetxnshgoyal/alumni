const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const schemas = require('./admin.schemas');
const controller = require('./admin.controller');

const router = Router();

// Every route in this file is admin-only.
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', controller.stats);
router.get('/users', validate({ query: schemas.usersQuery }), controller.listUsers);
router.patch('/alumni/:id/verification', validate({ params: schemas.idParam, body: schemas.verification }), controller.verifyAlumni);
router.patch('/users/:id/status', validate({ params: schemas.idParam, body: schemas.accountStatus }), controller.setAccountStatus);
router.get('/audit-logs', validate({ query: schemas.auditQuery }), controller.auditLogs);

module.exports = router;
