const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const schemas = require('./campaigns.schemas');
const controller = require('./campaigns.controller');

const router = Router();
const adminOnly = [authenticate, authorize('ADMIN')];

router.post('/', adminOnly, validate({ body: schemas.create }), controller.create);
router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', validate({ params: schemas.idParam }), controller.getById);
router.patch('/:id', adminOnly, validate({ params: schemas.idParam, body: schemas.update }), controller.update);
router.patch('/:id/close', adminOnly, validate({ params: schemas.idParam }), controller.close);

module.exports = router;
