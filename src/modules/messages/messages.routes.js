const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./messages.schemas');
const controller = require('./messages.controller');

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: schemas.create }), controller.send);
router.get('/', validate({ query: schemas.listQuery }), controller.list);

module.exports = router;
