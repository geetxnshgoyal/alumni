const { Router } = require('express');
const validate = require('../../middleware/validate');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const schemas = require('./donations.schemas');
const controller = require('./donations.controller');

const router = Router();

// 1. Create order & initiate donation (Authenticated donor: Alumni / Student / Admin)
router.post('/', authenticate, validate({ body: schemas.createOrder }), controller.createOrder);

// 2. Verify payment & settle donation (Authenticated donor)
router.post('/verify', authenticate, validate({ body: schemas.verifyPayment }), controller.verifyPayment);

// 3. Record payment failure (Authenticated donor)
router.post('/fail', authenticate, validate({ body: schemas.recordFailure }), controller.recordFailure);

// 4. Asynchronous payment gateway webhook (Provider-to-server callback)
router.post('/webhook', controller.handleWebhook);

// 5. List my donation history
router.get('/my', authenticate, validate({ query: schemas.listQuery }), controller.listMyDonations);

// 5. Public campaign donor list (with optional auth to show donor's own name if anonymous)
router.get('/campaign/:id', optionalAuth, validate({ params: schemas.idParam, query: schemas.listQuery }), controller.listCampaignDonations);

// 6. Get single donation details (donor or admin)
router.get('/:id', authenticate, validate({ params: schemas.idParam }), controller.getById);

// 7. Get formal donation receipt (printable HTML or JSON payload)
router.get('/:id/receipt', authenticate, validate({ params: schemas.idParam }), controller.getReceipt);

module.exports = router;
