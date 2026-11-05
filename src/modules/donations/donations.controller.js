const gateway = require('./payment-gateway.service');
const donations = require('./donations.model');
const ApiError = require('../../utils/ApiError');

async function createOrder(req, res, next) {
  try {
    const { campaignId, amount, currency = 'INR', isAnonymous = false, gateway: selectedGateway = 'RAZORPAY' } =
      req.valid?.body || req.body;
    const donorId = req.user.id || req.user.userId;

    // 1. Generate test-mode order with payment gateway provider
    const gatewayOrder = await gateway.createOrder({
      amount,
      currency,
      receipt: `campaign_${campaignId}_user_${donorId}`,
    });

    // 2. Persist donation and transaction atomically in DB
    const donation = await donations.createOrder({
      campaignId,
      donorId,
      amount,
      currency,
      isAnonymous,
      gateway: selectedGateway,
      gatewayOrderId: gatewayOrder.orderId,
    });

    res.status(201).json({
      data: {
        donation,
        gatewayOrder: {
          orderId: gatewayOrder.orderId,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
          keyId: gatewayOrder.keyId,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { donationId, gatewayOrderId, gatewayPaymentId, signature } = req.valid?.body || req.body;

    // 1. Verify cryptographic HMAC signature
    const isValid = gateway.verifySignature({
      orderId: gatewayOrderId,
      paymentId: gatewayPaymentId,
      signature,
    });

    if (!isValid) {
      throw ApiError.badRequest('Invalid payment signature verification failed');
    }

    // 2. Settle donation status to SUCCESS in DB
    const settled = await donations.recordPaymentSuccess({
      donationId,
      gatewayOrderId,
      gatewayPaymentId,
      signature,
    });

    res.json({
      data: settled,
      message: 'Payment verified and donation recorded successfully',
    });
  } catch (err) {
    next(err);
  }
}

async function recordFailure(req, res, next) {
  try {
    const { donationId, gatewayOrderId, reason } = req.valid?.body || req.body;

    const failed = await donations.recordPaymentFailure({
      donationId,
      gatewayOrderId,
      reason,
    });

    res.json({
      data: failed,
      message: 'Payment failure recorded',
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const donation = await donations.findById(req.params.id);
    if (!donation) {
      throw ApiError.notFound('Donation record not found');
    }

    const currentUserId = req.user.id || req.user.userId;
    const isDonor = currentUserId === donation.donorId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isDonor && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to view this donation');
    }

    res.json({ data: donation });
  } catch (err) {
    next(err);
  }
}

async function listMyDonations(req, res, next) {
  try {
    const donorId = req.user.id || req.user.userId;
    const result = await donations.listByDonor({
      donorId,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    next(err);
  }
}

async function listCampaignDonations(req, res, next) {
  try {
    const campaignId = Number(req.params.id);
    const viewerUserId = req.user?.id || req.user?.userId || null;
    const isAdmin = req.user?.role === 'ADMIN';

    const result = await donations.listByCampaign({
      campaignId,
      page: req.query.page,
      limit: req.query.limit,
      viewerUserId,
      isAdmin,
    });

    res.json({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    next(err);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const signature = req.get('x-razorpay-signature') || req.get('x-gateway-signature') || req.body?.signature;
    const rawPayload = req.body;

    if (signature) {
      const isValid = gateway.verifyWebhookSignature(rawPayload, signature);
      if (!isValid) {
        throw ApiError.badRequest('Invalid webhook signature verification failed');
      }
    }

    const event = req.body.event || 'payment.captured';
    const payload = req.body.payload || req.body;

    const result = await donations.handleWebhookEvent({ event, payload });

    res.json({
      status: 'ok',
      event,
      alreadyProcessed: result.alreadyProcessed ?? false,
      donationId: result.donation.donationId,
      donationStatus: result.donation.donationStatus,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  recordFailure,
  getById,
  listMyDonations,
  listCampaignDonations,
  handleWebhook,
};
