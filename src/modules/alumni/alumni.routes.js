const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./alumni.schemas');
const controller = require('./alumni.controller');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: schemas.search }), controller.search);
router.get('/filters', controller.filterOptions);
router.get('/:id', validate({ params: schemas.idParam }), controller.getById);

module.exports = router;
