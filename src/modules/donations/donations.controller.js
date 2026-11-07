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

function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return `${num} Rupees`;
  let str = '';
  str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += Number(n[5]) !== 0 ? (str !== '' ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Rupees Only';
}

async function getReceipt(req, res, next) {
  try {
    const donation = await donations.findById(req.params.id);
    if (!donation) {
      throw ApiError.notFound('Donation record not found');
    }

    const currentUserId = req.user.id || req.user.userId;
    const isDonor = currentUserId === donation.donorId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isDonor && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to access this receipt');
    }

    if (donation.donationStatus !== 'SUCCESS') {
      throw ApiError.badRequest('Receipt is only available for completed successful donations');
    }

    const receiptData = {
      receiptNo: donation.receiptNo,
      issuedAt: donation.receiptIssuedAt || donation.createdAt,
      donationId: donation.donationId,
      amount: donation.amount,
      amountInWords: numberToWords(donation.amount),
      currency: donation.currency,
      campaignTitle: donation.campaignTitle,
      donorName: donation.isAnonymous ? 'Anonymous Donor' : donation.donorName,
      donorEmail: donation.isAnonymous ? 'Restricted' : donation.donorEmail,
      gatewayOrderId: donation.gatewayOrderId,
      gatewayPaymentId: donation.gatewayPaymentId,
      taxExemptCode: '80G-ALUMNI-2026-EXEMPT',
      organization: 'Government Engineering College Alumni Foundation',
    };

    if (req.query.format === 'html' || (req.accepts('html') && !req.accepts('json'))) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Donation Receipt - ${receiptData.receiptNo}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; }
    .receipt-card { max-width: 650px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 22px; font-weight: 700; color: #1e40af; margin: 0; }
    .badge { background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 14px; }
    .amount-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin-bottom: 24px; text-align: center; }
    .amount-val { font-size: 28px; font-weight: 800; color: #1d4ed8; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; line-height: 1.5; }
    @media print { body { background: #fff; padding: 0; } .receipt-card { border: none; box-shadow: none; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <div>
        <h1 class="title">${receiptData.organization}</h1>
        <p style="margin:4px 0 0; font-size:13px; color:#64748b;">Official Donation Acknowledgment</p>
      </div>
      <span class="badge">Paid • Success</span>
    </div>

    <div class="meta-grid">
      <div><strong>Receipt Number:</strong> ${receiptData.receiptNo}</div>
      <div><strong>Date of Issue:</strong> ${new Date(receiptData.issuedAt).toLocaleDateString()}</div>
      <div><strong>Donor Name:</strong> ${receiptData.donorName}</div>
      <div><strong>Campaign:</strong> ${receiptData.campaignTitle}</div>
      <div><strong>Payment Reference:</strong> ${receiptData.gatewayPaymentId || 'N/A'}</div>
      <div><strong>Tax Exemption:</strong> Section 80G Eligible</div>
    </div>

    <div class="amount-box">
      <div style="font-size:13px; color:#3b82f6; font-weight:600; margin-bottom:4px;">TOTAL CONTRIBUTION</div>
      <div class="amount-val">₹${receiptData.amount.toLocaleString('en-IN')}</div>
      <div style="font-size:13px; color:#475569; margin-top:4px;">${receiptData.amountInWords}</div>
    </div>

    <div class="footer">
      <p>This electronic receipt is automatically generated and acknowledged by ${receiptData.organization} under certificate ref <code>${receiptData.taxExemptCode}</code>. Retain this acknowledgment for tax records.</p>
      <div class="no-print" style="margin-top:20px; text-align:center;">
        <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600;">Print Receipt</button>
      </div>
    </div>
  </div>
</body>
</html>`;
      return res.type('html').send(html);
    }

    res.json({ data: receiptData });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  recordFailure,
  getById,
  getReceipt,
  listMyDonations,
  listCampaignDonations,
  handleWebhook,
};
