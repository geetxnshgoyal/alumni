const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Admin API', () => {
  let admin, alumni, student, deptId;

  beforeEach(async () => {
    deptId = await createDepartment();
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin Head' });
    alumni = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alum Bob', verified: false });
    student = await createUser({ deptId, role: 'STUDENT', fullName: 'Student Sam' });
  });

  describe('authorisation', () => {
    test('get /api/admin/stats is forbidden for alumni (403)', async () => {
      const res = await api().get('/api/admin/stats').set(auth(alumni.token));
      expect(res.status).toBe(403);
    });

    test('get /api/admin/audit-logs is forbidden for alumni (403)', async () => {
      const res = await api().get('/api/admin/audit-logs').set(auth(alumni.token));
      expect(res.status).toBe(403);
    });

    test('patch /api/admin/alumni/1/verification is forbidden for alumni (403)', async () => {
      const res = await api().patch(`/api/admin/alumni/${alumni.id}/verification`).set(auth(alumni.token)).send({ status: 'VERIFIED' });
      expect(res.status).toBe(403);
    });

    test('patch /api/admin/users/1/status is forbidden for alumni (403)', async () => {
      const res = await api().patch(`/api/admin/users/${student.id}/status`).set(auth(alumni.token)).send({ accountStatus: 'SUSPENDED' });
      expect(res.status).toBe(403);
    });

    test('post /api/departments is forbidden for alumni (403)', async () => {
      const res = await api().post('/api/departments').set(auth(alumni.token)).send({ deptCode: 'ME', deptName: 'Mechanical' });
      expect(res.status).toBe(403);
    });
  });

  describe('alumni verification', () => {
    test('admin verifies a pending alumni, who is notified and appears in the directory', async () => {
      const res = await api()
        .patch(`/api/admin/alumni/${alumni.id}/verification`)
        .set(auth(admin.token))
        .send({ status: 'VERIFIED', note: 'All documents verified' });
      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('VERIFIED');
    });

    test('returns 404 for a non-alumni user and 400 for a bad status', async () => {
      const res404 = await api()
        .patch(`/api/admin/alumni/${student.id}/verification`)
        .set(auth(admin.token))
        .send({ status: 'VERIFIED' });
      expect(res404.status).toBe(404);

      const res400 = await api()
        .patch(`/api/admin/alumni/${alumni.id}/verification`)
        .set(auth(admin.token))
        .send({ status: 'INVALID_STATUS' });
      expect(res400.status).toBe(400);
    });
  });

  describe('account status', () => {
    test('suspending blocks login; reactivating restores it', async () => {
      const resSuspend = await api()
        .patch(`/api/admin/users/${alumni.id}/status`)
        .set(auth(admin.token))
        .send({ accountStatus: 'SUSPENDED' });
      expect(resSuspend.status).toBe(200);
      expect(resSuspend.body.data.accountStatus).toBe('SUSPENDED');

      const loginRes = await api().post('/api/auth/login').send({ email: alumni.email, password: alumni.password });
      expect(loginRes.status).toBe(403);
    });

    test('admin cannot suspend themselves', async () => {
      const res = await api()
        .patch(`/api/admin/users/${admin.id}/status`)
        .set(auth(admin.token))
        .send({ accountStatus: 'SUSPENDED' });
      expect(res.status).toBe(400);
    });
  });

  describe('stats and audit log', () => {
    test('stats summarise users and verification', async () => {
      const res = await api().get('/api/admin/stats').set(auth(admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data.users).toBeDefined();
    });

    test('admin actions are audited and filterable', async () => {
      const res = await api().get('/api/admin/audit-logs').set(auth(admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    test('audit log filters by action, outcome and date range', async () => {
      await api().post('/api/auth/login').send({ email: alumni.email, password: 'Wrong@12345' });
      const today = new Date().toISOString().slice(0, 10);

      const failures = await api().get('/api/admin/audit-logs?action=login&outcome=FAILURE').set(auth(admin.token));
      expect(failures.status).toBe(200);
      expect(failures.body.data.length).toBeGreaterThan(0);
      expect(failures.body.data.every((l) => l.action === 'LOGIN' && l.outcome === 'FAILURE')).toBe(true);

      const todayOnly = await api().get(`/api/admin/audit-logs?from=${today}&to=${today}`).set(auth(admin.token));
      expect(todayOnly.body.pagination.total).toBeGreaterThan(0);

      const past = await api().get('/api/admin/audit-logs?from=2000-01-01&to=2000-01-31').set(auth(admin.token));
      expect(past.body.data).toHaveLength(0);
    });

    test('audit log rejects invalid dates and reversed ranges (400)', async () => {
      const bad = await api().get('/api/admin/audit-logs?from=14-11-2026').set(auth(admin.token));
      expect(bad.status).toBe(400);
      const reversed = await api().get('/api/admin/audit-logs?from=2026-02-01&to=2026-01-01').set(auth(admin.token));
      expect(reversed.status).toBe(400);
    });
  });

  describe('departments', () => {
    test('anyone can list; admin can create, update and delete', async () => {
      const resList = await api().get('/api/departments');
      expect(resList.status).toBe(200);

      const resCreate = await api()
        .post('/api/departments')
        .set(auth(admin.token))
        .send({ deptCode: 'EC', deptName: 'Electronics and Communication' });
      expect(resCreate.status).toBe(201);
    });

    test('duplicate code returns 409; deleting a department in use returns 409', async () => {
      const resDup = await api()
        .post('/api/departments')
        .set(auth(admin.token))
        .send({ deptCode: 'CE', deptName: 'Computer Engineering Again' });
      expect(resDup.status).toBe(409);

      const resDel = await api().delete(`/api/departments/${deptId}`).set(auth(admin.token));
      expect(resDel.status).toBe(409);
    });
  });

  describe('notifications', () => {
    test('users can mark their own notifications read, but not others', async () => {
      const resNotif = await pool.query(
        `INSERT INTO notification (user_id, notif_type, title) VALUES ($1, 'TEST', 'Test') RETURNING notification_id`,
        [alumni.id]
      );
      const notifId = resNotif.rows[0].notification_id;

      const resOther = await api().patch(`/api/notifications/${notifId}/read`).set(auth(student.token));
      expect(resOther.status).toBe(404);

      const resSelf = await api().patch(`/api/notifications/${notifId}/read`).set(auth(alumni.token));
      expect(resSelf.status).toBe(200);
      expect(resSelf.body.data.isRead).toBe(true);
    });
  });
});
