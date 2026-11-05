const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./connections.schemas');
const controller = require('./connections.controller');

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: schemas.create }), controller.create);

module.exports = router;
