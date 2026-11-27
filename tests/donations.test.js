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
      const logged = (await pool.query("SELECT action, outcome, error_code FROM audit_log WHERE action = $1", ['DONATION_SUCCESS'])).rows;
      expect(logged).toHaveLength(1);

      // 3. Campaign amount raised should now reflect this donation
      const campRes = await api().get(`/api/campaigns/${campaign.campaignId}`);
      expect(campRes.body.data.amountRaised).toBe(5000);
      expect(campRes.body.data.donorCount).toBe(1);
    });

    it('issues exactly one receipt even when the payment is verified twice (#C3)', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 2500 });
      const { donation, gatewayOrder } = orderRes.body.data;
      const paymentId = gateway.generateTestPaymentId();
      const body = {
        donationId: donation.donationId,
        gatewayOrderId: gatewayOrder.orderId,
        gatewayPaymentId: paymentId,
        signature: gateway.generateSignature({ orderId: gatewayOrder.orderId, paymentId }),
      };

      const first = await api().post('/api/donations/verify').set(auth(alum1.token)).send(body);
      const second = await api().post('/api/donations/verify').set(auth(alum1.token)).send(body);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.receiptNo).toBe(first.body.data.receiptNo);
      const receipts = await pool.query('SELECT receipt_no FROM donation_receipt WHERE donation_id = $1', [donation.donationId]);
      expect(receipts.rows).toHaveLength(1);

      const campRes = await api().get(`/api/campaigns/${campaign.campaignId}`);
      expect(campRes.body.data.amountRaised).toBe(2500); // not double-counted
    });

    it('test-mode checkout signs the payment for the donor so verify settles it', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 1500 });
      const { donation } = orderRes.body.data;
      const checkoutUrl = `/api/donations/${donation.donationId}/test-checkout`;

      // Only the donor can check out their own donation
      expect((await api().post(checkoutUrl).set(auth(alum2.token))).status).toBe(404);

      const checkout = await api().post(checkoutUrl).set(auth(alum1.token));
      expect(checkout.status).toBe(200);

      const verify = await api().post('/api/donations/verify').set(auth(alum1.token)).send(checkout.body.data);
      expect(verify.status).toBe(200);
      expect(verify.body.data.donationStatus).toBe('SUCCESS');

      // A settled donation cannot be checked out again
      expect((await api().post(checkoutUrl).set(auth(alum1.token))).status).toBe(409);
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
      const logged = (await pool.query("SELECT action, outcome, error_code FROM audit_log WHERE action = $1", ['DONATION_VERIFY'])).rows;
      expect(logged).toEqual([{ action: 'DONATION_VERIFY', outcome: 'FAILURE', error_code: 'BAD_SIGNATURE' }]);

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

      // Another user cannot fail someone else's donation
      const otherRes = await api()
        .post('/api/donations/fail')
        .set(auth(alum2.token))
        .send({ donationId: donation.donationId, gatewayOrderId: gatewayOrder.orderId });
      expect(otherRes.status).toBe(404);

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

    it('rejects an unsigned webhook and leaves the donation unpaid', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 3000 });
      const { donation, gatewayOrder } = orderRes.body.data;

      const res = await api()
        .post('/api/donations/webhook')
        .send({ event: 'payment.captured', payload: { orderId: gatewayOrder.orderId, paymentId: 'pay_forged' } });

      expect(res.status).toBe(400);
      const { rows } = await pool.query('SELECT donation_status FROM donation WHERE donation_id = $1', [donation.donationId]);
      expect(rows[0].donation_status).toBe('INITIATED');
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

  describe('GET /api/donations/:id/receipt (Formal Tax Receipt Generation #C3)', () => {
    it('generates and returns formal receipt payload for settled donation', async () => {
      // 1. Create and settle donation
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 10000 });
      const { donation, gatewayOrder } = orderRes.body.data;
      const paymentId = gateway.generateTestPaymentId();

      await api().post('/api/donations/verify').set(auth(alum1.token)).send({
        donationId: donation.donationId,
        gatewayOrderId: gatewayOrder.orderId,
        gatewayPaymentId: paymentId,
        signature: gateway.generateSignature({ orderId: gatewayOrder.orderId, paymentId }),
      });

      // 2. Fetch JSON receipt
      const receiptRes = await api()
        .get(`/api/donations/${donation.donationId}/receipt`)
        .set(auth(alum1.token));

      expect(receiptRes.status).toBe(200);
      expect(receiptRes.body.data.receiptNo).toMatch(/^REC-2026-\d{6}$/);
      expect(receiptRes.body.data.amount).toBe(10000);
      expect(receiptRes.body.data.amountInWords).toContain('Ten Thousand Rupees Only');
      expect(receiptRes.body.data.taxExemptCode).toBe('80G-ALUMNI-2026-EXEMPT');

      // 3. Fetch HTML printable receipt
      const htmlRes = await api()
        .get(`/api/donations/${donation.donationId}/receipt?format=html`)
        .set(auth(alum1.token));

      expect(htmlRes.status).toBe(200);
      expect(htmlRes.text).toContain('Official Donation Acknowledgment');
      expect(htmlRes.text).toContain(receiptRes.body.data.receiptNo);
    });

    it('denies receipt with 400 if donation is not successful', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 2000 });
      const { donation } = orderRes.body.data;

      const res = await api()
        .get(`/api/donations/${donation.donationId}/receipt`)
        .set(auth(alum1.token));

      expect(res.status).toBe(400);
    });

    it('denies other alumni with 403 when trying to access someone else receipt', async () => {
      const orderRes = await api()
        .post('/api/donations')
        .set(auth(alum1.token))
        .send({ campaignId: campaign.campaignId, amount: 3000 });
      const { donation, gatewayOrder } = orderRes.body.data;
      const paymentId = gateway.generateTestPaymentId();

      await api().post('/api/donations/verify').set(auth(alum1.token)).send({
        donationId: donation.donationId,
        gatewayOrderId: gatewayOrder.orderId,
        gatewayPaymentId: paymentId,
        signature: gateway.generateSignature({ orderId: gatewayOrder.orderId, paymentId }),
      });

      const res = await api()
        .get(`/api/donations/${donation.donationId}/receipt`)
        .set(auth(alum2.token));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/donations/campaign/:id/top-donors (Leaderboard with window functions)', () => {
    let alum3;

    beforeEach(async () => {
      alum3 = await createUser({ role: 'STUDENT', fullName: 'Small Donor', deptId: await createDepartment('ME', 'Mechanical') });
      // alum1 gives 3000 + 2000, alum2 gives 5000 anonymously (tie), alum3 gives 1000.
      // The FAILED and INITIATED rows must not count.
      await pool.query(
        `INSERT INTO donation (campaign_id, donor_id, amount, is_anonymous, donation_status) VALUES
           ($1, $2, 3000, false, 'SUCCESS'), ($1, $2, 2000, false, 'SUCCESS'),
           ($1, $3, 5000, true,  'SUCCESS'), ($1, $4, 1000, false, 'SUCCESS'),
           ($1, $4, 99999, false, 'FAILED'), ($1, $4, 88888, false, 'INITIATED')`,
        [campaign.campaignId, alum1.id, alum2.id, alum3.id]
      );
    });

    it('ranks donors by total SUCCESS amount, ties share a rank, with share of total', async () => {
      const res = await api().get(`/api/donations/campaign/${campaign.campaignId}/top-donors`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((d) => d.rank)).toEqual([1, 1, 3]);
      expect(res.body.data.map((d) => d.totalAmount)).toEqual([5000, 5000, 1000]);
      expect(res.body.data.map((d) => d.sharePercent)).toEqual([45.5, 45.5, 9.1]);
      const ravi = res.body.data.find((d) => d.donorName === 'Ravi Donor');
      expect(ravi.donationCount).toBe(2);
    });

    it('masks anonymous donors publicly but not for admin or the donor themself', async () => {
      const names = async (token) => {
        const req = api().get(`/api/donations/campaign/${campaign.campaignId}/top-donors`);
        const res = token ? await req.set(auth(token)) : await req;
        return res.body.data.map((d) => d.donorName);
      };

      expect(await names()).toContain('Anonymous Donor');
      expect(await names()).not.toContain('Anonymous Donor Alum');
      expect(await names(admin.token)).toContain('Anonymous Donor Alum');
      expect(await names(alum2.token)).toContain('Anonymous Donor Alum');
      expect(await names(alum1.token)).not.toContain('Anonymous Donor Alum');
    });

    it('respects limit, rejects invalid limit with 400 and unknown campaign with 404', async () => {
      const url = `/api/donations/campaign/${campaign.campaignId}/top-donors`;
      const one = await api().get(`${url}?limit=1`);
      expect(one.status).toBe(200);
      expect(one.body.data).toHaveLength(1);

      expect((await api().get(`${url}?limit=50`)).status).toBe(400);
      expect((await api().get('/api/donations/campaign/999999/top-donors')).status).toBe(404);
    });
  });
});
