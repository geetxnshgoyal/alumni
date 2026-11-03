const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Campaigns API', () => {
  let admin, alum;

  beforeEach(async () => {
    const deptId = await createDepartment();
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin User' });
    alum = await createUser({ deptId, role: 'ALUMNI', fullName: 'Generous Alum' });
  });

  describe('POST /api/campaigns', () => {
    it('allows admins to create a new campaign', async () => {
      const res = await api()
        .post('/api/campaigns')
        .set(auth(admin.token))
        .send({
          title: 'Campus Library Upgrade',
          description: 'Help renovate the central campus library with new study spaces and digital tools.',
          goalAmount: 100000,
          startDate: '2026-11-01',
          endDate: '2026-12-31',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Campus Library Upgrade');
      expect(res.body.data.goalAmount).toBe(100000);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('denies non-admin users with 403', async () => {
      const res = await api()
        .post('/api/campaigns')
        .set(auth(alum.token))
        .send({
          title: 'Unauthorized Fund',
          description: 'Should be rejected because author is not admin.',
          goalAmount: 50000,
          startDate: '2026-11-01',
          endDate: '2026-12-31',
        });

      expect(res.status).toBe(403);
    });

    it('rejects end date before start date with 400', async () => {
      const res = await api()
        .post('/api/campaigns')
        .set(auth(admin.token))
        .send({
          title: 'Invalid Dates Fund',
          description: 'Start date after end date.',
          goalAmount: 50000,
          startDate: '2026-12-31',
          endDate: '2026-11-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });
  });

  describe('GET /api/campaigns', () => {
    let campaignId;

    beforeEach(async () => {
      const cRes = await api()
        .post('/api/campaigns')
        .set(auth(admin.token))
        .send({
          title: 'Lab Equipment Drive',
          description: 'New robotics lab kits for current engineering students.',
          goalAmount: 200000,
          startDate: '2026-11-01',
          endDate: '2026-12-31',
        });
      campaignId = cRes.body.data.campaignId;

      // Add dummy successful donation directly to verify amountRaised calculation
      await pool.query(
        `INSERT INTO donation (campaign_id, donor_id, amount, donation_status)
         VALUES ($1, $2, 25000, 'SUCCESS')`,
        [campaignId, alum.id]
      );
    });

    it('lists campaigns with aggregate amount raised', async () => {
      const res = await api().get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const camp = res.body.data.find((c) => c.campaignId === campaignId);
      expect(camp).toBeDefined();
      expect(camp.amountRaised).toBe(25000);
      expect(camp.donorCount).toBe(1);
    });

    it('returns a single campaign by ID with amount raised', async () => {
      const res = await api().get(`/api/campaigns/${campaignId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.campaignId).toBe(campaignId);
      expect(res.body.data.amountRaised).toBe(25000);
    });

    it('returns 404 for missing campaign ID', async () => {
      const res = await api().get('/api/campaigns/999999');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/campaigns/:id & /close', () => {
    let campaignId;

    beforeEach(async () => {
      const cRes = await api()
        .post('/api/campaigns')
        .set(auth(admin.token))
        .send({
          title: 'Sports Complex Turf',
          description: 'Replace aging athletic turf for sports ground.',
          goalAmount: 80000,
          startDate: '2026-11-01',
          endDate: '2026-12-31',
        });
      campaignId = cRes.body.data.campaignId;
    });

    it('allows admin to update campaign details', async () => {
      const res = await api()
        .patch(`/api/campaigns/${campaignId}`)
        .set(auth(admin.token))
        .send({ goalAmount: 95000 });

      expect(res.status).toBe(200);
      expect(res.body.data.goalAmount).toBe(95000);
    });

    it('allows admin to close campaign', async () => {
      const res = await api()
        .patch(`/api/campaigns/${campaignId}/close`)
        .set(auth(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('denies non-admin from closing campaign with 403', async () => {
      const res = await api()
        .patch(`/api/campaigns/${campaignId}/close`)
        .set(auth(alum.token));

      expect(res.status).toBe(403);
    });
  });
});
