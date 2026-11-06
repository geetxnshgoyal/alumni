const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./connections.schemas');
const controller = require('./connections.controller');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.post('/', validate({ body: schemas.create }), controller.create);
router.get('/:id', validate({ params: schemas.idParam }), controller.getById);
router.patch('/:id/accept', validate({ params: schemas.idParam }), controller.accept);
router.patch('/:id/reject', validate({ params: schemas.idParam }), controller.reject);

module.exports = router;
