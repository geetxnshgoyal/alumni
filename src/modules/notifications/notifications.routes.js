const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const schemas = require('./notifications.schemas');
const controller = require('./notifications.controller');

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: schemas.listQuery }), controller.list);
router.patch('/:id/read', validate({ params: schemas.idParam }), controller.markRead);
router.post('/read-all', controller.markAllRead);

module.exports = router;
