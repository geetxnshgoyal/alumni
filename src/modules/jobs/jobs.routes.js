const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const schemas = require('./jobs.schemas');
const controller = require('./jobs.controller');

const router = Router();
const canPost = [authenticate, authorize('ADMIN', 'ALUMNI')];

router.post('/', canPost, validate({ body: schemas.create }), controller.create);
router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', validate({ params: schemas.idParam }), controller.getById);

module.exports = router;

