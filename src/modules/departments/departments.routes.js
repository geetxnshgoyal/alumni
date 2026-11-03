const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const schemas = require('./departments.schemas');
const controller = require('./departments.controller');

const router = Router();
const adminOnly = [authenticate, authorize('ADMIN')];

router.get('/', controller.list);
router.post('/', adminOnly, validate({ body: schemas.create }), controller.create);
router.patch('/:id', adminOnly, validate({ params: schemas.idParam, body: schemas.update }), controller.update);
router.delete('/:id', adminOnly, validate({ params: schemas.idParam }), controller.remove);

module.exports = router;
