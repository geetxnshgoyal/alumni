const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');
const gateway = require('../src/modules/donations/payment-gateway.service');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Donations & Payment Gateway API (#C2)', () => {
  let admin, alum1, alum2, campaign;

  beforeEach(async () => {
    const deptId = await createDepartment();
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin User' });
    alum1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Ravi Donor' });
    alum2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Anonymous Donor Alum' });

    // Seed active campaign
    const res = await api()
      .post('/api/campaigns')
      .set(auth(admin.token))
      .send({
        title: 'Tech Lab Renovation 2026',
        description: 'Modernizing student computer lab with high-speed workstations.',
        goalAmount: 500000,
        startDate: '2026-11-01',
        endDate: '2026-12-31',
      });
    campaign = res.body.data;
  });

  describe('POST /api/donations (Order Creation)', () => {
    it('creates a test-mode donation order with linked payment transaction', async () => {
      const res = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 2500,
          currency: 'INR',
          isAnonymous: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.donation.donationId).toBeDefined();
      expect(res.body.data.donation.amount).toBe(2500);
      expect(res.body.data.donation.donationStatus).toBe('INITIATED');
      expect(res.body.data.donation.transaction.transactionStatus).toBe('INITIATED');
      expect(res.body.data.gatewayOrder.orderId).toMatch(/^order_test_/);
      expect(res.body.data.gatewayOrder.amount).toBe(2500);
      expect(res.body.data.gatewayOrder.keyId).toBeDefined();
    });

    it('rejects donation when amount is below minimum (< 10) with 400', async () => {
      const res = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some((d) => d.field === 'amount')).toBe(true);
    });

    it('rejects donation for non-existent campaign with 404', async () => {
      const res = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: 99999,
          amount: 500,
        });

      expect(res.status).toBe(404);
    });

    it('rejects donation if campaign is closed with 400', async () => {
      // Close campaign
      await api().patch(`/api/campaigns/${campaign.campaignId}/close`).set(auth(admin.token));

      const res = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 1000,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/donations/verify (Payment Signature Verification)', () => {
    it('verifies valid HMAC signature, settles donation to SUCCESS and auto-generates receipt', async () => {
      // 1. Initiate order
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 5000,
        });

      const { donation, gatewayOrder } = orderRes.body.data;
      const paymentId = gateway.generateTestPaymentId();
      const validSignature = gateway.generateSignature({
        orderId: gatewayOrder.orderId,
        paymentId,
      });

      // 2. Call verify endpoint
      const verifyRes = await api()
        .post('/api/donations/verify')
        .set(auth(alum1.token))
        .send({
          donationId: donation.donationId,
          gatewayOrderId: gatewayOrder.orderId,
          gatewayPaymentId: paymentId,
          signature: validSignature,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.donationStatus).toBe('SUCCESS');
      expect(verifyRes.body.data.transactionStatus).toBe('SUCCESS');
      expect(verifyRes.body.data.gatewayPaymentId).toBe(paymentId);
      expect(verifyRes.body.data.receiptNo).toMatch(/^REC-2026-\d{6}$/);

      // 3. Campaign amount raised should now reflect this donation
      const campRes = await api().get(`/api/campaigns/${campaign.campaignId}`);
      expect(campRes.body.data.amountRaised).toBe(5000);
      expect(campRes.body.data.donorCount).toBe(1);
    });

    it('rejects tampered signature with 400 verification failure', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 1000,
        });

      const { donation, gatewayOrder } = orderRes.body.data;
      const paymentId = gateway.generateTestPaymentId();

      const verifyRes = await api()
        .post('/api/donations/verify')
        .set(auth(alum1.token))
        .send({
          donationId: donation.donationId,
          gatewayOrderId: gatewayOrder.orderId,
          gatewayPaymentId: paymentId,
          signature: 'invalid_fraudulent_tampered_signature_12345',
        });

      expect(verifyRes.status).toBe(400);

      // Verify donation remained INITIATED
      const checkRes = await api()
        .get(`/api/donations/${donation.donationId}`)
        .set(auth(alum1.token));
      expect(checkRes.body.data.donationStatus).toBe('INITIATED');
    });
  });

  describe('POST /api/donations/fail (Payment Failure Logging)', () => {
    it('records failed transactions properly', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({
          campaignId: campaign.campaignId,
          amount: 1500,
        });

      const { donation, gatewayOrder } = orderRes.body.data;

      const failRes = await api()
        .post('/api/donations/fail')
        .set(auth(alum1.token))
        .send({
          donationId: donation.donationId,
          gatewayOrderId: gatewayOrder.orderId,
          reason: 'User cancelled payment at gateway',
        });

      expect(failRes.status).toBe(200);
      expect(failRes.body.data.donationStatus).toBe('FAILED');
      expect(failRes.body.data.transactionStatus).toBe('FAILED');

      // Failed donations do not contribute to campaign amount raised
      const campRes = await api().get(`/api/campaigns/${campaign.campaignId}`);
      expect(campRes.body.data.amountRaised).toBe(0);
    });
  });

  describe('GET /api/donations/campaign/:id (Donor Wall & Privacy)', () => {
    it('masks anonymous donors for public viewers but shows name to admin', async () => {
      // 1. Regular donation from alum1
      const res1 = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 2000, isAnonymous: false });
      const pay1 = gateway.generateTestPaymentId();
      await api().post('/api/donations/verify').set(auth(alum1.token)).send({
        donationId: res1.body.data.donation.donationId,
        gatewayOrderId: res1.body.data.gatewayOrder.orderId,
        gatewayPaymentId: pay1,
        signature: gateway.generateSignature({ orderId: res1.body.data.gatewayOrder.orderId, paymentId: pay1 }),
      });

      // 2. Anonymous donation from alum2
      const res2 = await api()
        .post('/api/donations')
        .set(auth(alum2.token))
        .send({ campaignId: campaign.campaignId, amount: 3000, isAnonymous: true });
      const pay2 = gateway.generateTestPaymentId();
      await api().post('/api/donations/verify').set(auth(alum2.token)).send({
        donationId: res2.body.data.donation.donationId,
        gatewayOrderId: res2.body.data.gatewayOrder.orderId,
        gatewayPaymentId: pay2,
        signature: gateway.generateSignature({ orderId: res2.body.data.gatewayOrder.orderId, paymentId: pay2 }),
      });

      // Public viewer sees masked name
      const publicRes = await api().get(`/api/donations/campaign/${campaign.campaignId}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data).toHaveLength(2);
      const names = publicRes.body.data.map((d) => d.donorName);
      expect(names).toContain('Ravi Donor');
      expect(names).toContain('Anonymous Donor');

      // Admin sees real name
      const adminRes = await api()
        .get(`/api/donations/campaign/${campaign.campaignId}`)
        .set(auth(admin.token));
      const adminNames = adminRes.body.data.map((d) => d.donorName);
      expect(adminNames).toContain('Anonymous Donor Alum');
    });
  });

  describe('GET /api/donations/my (Donor History)', () => {
    it('returns history of logged-in user donations', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 1200 });

      const historyRes = await api().get('/api/donations/my').set(auth(alum1.token));
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].amount).toBe(1200);
    });
  });

  describe('POST /api/donations/webhook (Gateway Webhook Events)', () => {
    it('idempotently handles payment.captured webhook with valid HMAC signature', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 4500 });
      const { gatewayOrder } = orderRes.body.data;

      const paymentId = gateway.generateTestPaymentId();
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          orderId: gatewayOrder.orderId,
          paymentId,
        },
      };

      const webhookSig = gateway.generateWebhookSignature(webhookPayload);

      // First webhook delivery
      const res1 = await api()
        .post('/api/donations/webhook')
        .set('x-razorpay-signature', webhookSig)
        .send(webhookPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.donationStatus).toBe('SUCCESS');
      expect(res1.body.alreadyProcessed).toBe(false);

      // Duplicate delivery (idempotency check)
      const res2 = await api()
        .post('/api/donations/webhook')
        .set('x-razorpay-signature', webhookSig)
        .send(webhookPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.alreadyProcessed).toBe(true);
    });

    it('rejects webhook with invalid signature with 400', async () => {
      const res = await api()
        .post('/api/donations/webhook')
        .set('x-razorpay-signature', 'forged_signature_00000')
        .send({
          event: 'payment.captured',
          payload: { orderId: 'order_test_fake' },
        });

      expect(res.status).toBe(400);
    });

    it('handles payment.failed webhook event', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 2000 });
      const { gatewayOrder } = orderRes.body.data;

      const webhookPayload = {
        event: 'payment.failed',
        payload: {
          orderId: gatewayOrder.orderId,
          reason: 'Card expired at issuer bank',
        },
      };

      const webhookSig = gateway.generateWebhookSignature(webhookPayload);

      const res = await api()
        .post('/api/donations/webhook')
        .set('x-razorpay-signature', webhookSig)
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.donationStatus).toBe('FAILED');
    });
  });
});
