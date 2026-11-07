const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Connections API', () => {
  let user1, user2, user3, admin;

  beforeEach(async () => {
    const deptId = await createDepartment();
    user1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alice Alum' });
    user2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Bob Alum' });
    user3 = await createUser({ deptId, role: 'STUDENT', fullName: 'Charlie Student' });
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin User' });
  });

  describe('POST /api/connections (send connection request)', () => {
    it('creates a connection request with default NETWORK type (201)', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });

      expect(res.status).toBe(201);
      expect(res.body.data.connectionId).toBeDefined();
      expect(res.body.data.requesterId).toBe(user1.id);
      expect(res.body.data.receiverId).toBe(user2.id);
      expect(res.body.data.connectionType).toBe('NETWORK');
      expect(res.body.data.status).toBe('PENDING');

      // Verify notification created for receiver
      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [user2.id, 'CONNECTION_REQUEST']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('Alice Alum');
    });

    it('creates a connection request with MENTORSHIP type and note (201)', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user3.token))
        .send({
          receiverId: user1.id,
          connectionType: 'MENTORSHIP',
          requestNote: 'I would appreciate career mentorship in tech.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.connectionType).toBe('MENTORSHIP');
      expect(res.body.data.requestNote).toBe('I would appreciate career mentorship in tech.');

      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [user1.id, 'CONNECTION_REQUEST']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].body).toBe('I would appreciate career mentorship in tech.');
    });

    it('rejects connecting to yourself with 400', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user1.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/cannot connect to yourself/i);
    });

    it('rejects invalid connection type with 400', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id, connectionType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('requires authentication (401)', async () => {
      const res = await api()
        .post('/api/connections')
        .send({ receiverId: user2.id });

      expect(res.status).toBe(401);
    });

    it('returns 404 when receiver does not exist', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: 999999 });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/user not found/i);
    });

    it('rejects duplicate connection request in same direction with 409', async () => {
      await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });

      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('rejects duplicate connection request in reverse direction with 409', async () => {
      await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });

      const res = await api()
        .post('/api/connections')
        .set(auth(user2.token))
        .send({ receiverId: user1.id });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already exists/i);
    });
  });

  describe('PATCH /api/connections/:id/accept', () => {
    let connectionId;

    beforeEach(async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id, connectionType: 'NETWORK' });
      connectionId = res.body.data.connectionId;
    });

    it('allows receiver to accept connection request (200) and notifies requester', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/accept`)
        .set(auth(user2.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACCEPTED');
      expect(res.body.data.respondedAt).toBeDefined();

      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [user1.id, 'CONNECTION_ACCEPTED']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('Bob Alum accepted');
    });

    it('rejects requester from accepting their own request with 403', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/accept`)
        .set(auth(user1.token));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the receiver/i);
    });

    it('rejects third-party user from accepting the request with 403', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/accept`)
        .set(auth(user3.token));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the receiver/i);
    });

    it('returns 404 when connection does not exist', async () => {
      const res = await api()
        .patch('/api/connections/999999/accept')
        .set(auth(user2.token));

      expect(res.status).toBe(404);
    });

    it('requires authentication (401)', async () => {
      const res = await api().patch(`/api/connections/${connectionId}/accept`);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/connections/:id/reject', () => {
    let connectionId;

    beforeEach(async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });
      connectionId = res.body.data.connectionId;
    });

    it('allows receiver to reject connection request (200)', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/reject`)
        .set(auth(user2.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.respondedAt).toBeDefined();
    });

    it('rejects requester from rejecting the request with 403', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/reject`)
        .set(auth(user1.token));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the receiver/i);
    });

    it('rejects third-party user from rejecting the request with 403', async () => {
      const res = await api()
        .patch(`/api/connections/${connectionId}/reject`)
        .set(auth(user3.token));

      expect(res.status).toBe(403);
    });

    it('returns 404 when connection does not exist', async () => {
      const res = await api()
        .patch('/api/connections/999999/reject')
        .set(auth(user2.token));

      expect(res.status).toBe(404);
    });

    it('requires authentication (401)', async () => {
      const res = await api().patch(`/api/connections/${connectionId}/reject`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/connections (list)', () => {
    let conn1, conn2;

    beforeEach(async () => {
      const r1 = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id, connectionType: 'NETWORK' });
      conn1 = r1.body.data;

      const r2 = await api()
        .post('/api/connections')
        .set(auth(user3.token))
        .send({ receiverId: user1.id, connectionType: 'MENTORSHIP', requestNote: 'Need advice' });
      conn2 = r2.body.data;

      await api()
        .patch(`/api/connections/${conn1.connectionId}/accept`)
        .set(auth(user2.token));
    });

    it('lists connections where user is requester or receiver with pagination (200)', async () => {
      const res = await api()
        .get('/api/connections')
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
    });

    it('filters connections by status (200)', async () => {
      const res = await api()
        .get('/api/connections?status=ACCEPTED')
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].connectionId).toBe(conn1.connectionId);
      expect(res.body.data[0].status).toBe('ACCEPTED');
    });

    it('filters connections by type (200)', async () => {
      const res = await api()
        .get('/api/connections?type=MENTORSHIP')
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].connectionId).toBe(conn2.connectionId);
      expect(res.body.data[0].connectionType).toBe('MENTORSHIP');
    });

    it('supports pagination limit and page (200)', async () => {
      const res = await api()
        .get('/api/connections?page=1&limit=1')
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.limit).toBe(1);
    });

    it('requires authentication (401)', async () => {
      const res = await api().get('/api/connections');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/connections/:id (get single connection)', () => {
    let connId;

    beforeEach(async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(user1.token))
        .send({ receiverId: user2.id });
      connId = res.body.data.connectionId;
    });

    it('allows requester to view connection details (200)', async () => {
      const res = await api()
        .get(`/api/connections/${connId}`)
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data.connectionId).toBe(connId);
      expect(res.body.data.requesterName).toBe('Alice Alum');
      expect(res.body.data.receiverName).toBe('Bob Alum');
    });

    it('allows receiver to view connection details (200)', async () => {
      const res = await api()
        .get(`/api/connections/${connId}`)
        .set(auth(user2.token));

      expect(res.status).toBe(200);
      expect(res.body.data.connectionId).toBe(connId);
    });

    it('allows admin to view any connection details (200)', async () => {
      const res = await api()
        .get(`/api/connections/${connId}`)
        .set(auth(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.data.connectionId).toBe(connId);
    });

    it('denies third-party user from viewing connection with 403', async () => {
      const res = await api()
        .get(`/api/connections/${connId}`)
        .set(auth(user3.token));

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent connection ID', async () => {
      const res = await api()
        .get('/api/connections/999999')
        .set(auth(user1.token));

      expect(res.status).toBe(404);
    });

    it('requires authentication (401)', async () => {
      const res = await api().get(`/api/connections/${connId}`);
      expect(res.status).toBe(401);
    });
  });
});
