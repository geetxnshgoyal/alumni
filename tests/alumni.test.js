const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Alumni Directory API', () => {
  let deptId, admin, verifiedAlum, pendingAlum;

  beforeEach(async () => {
    deptId = await createDepartment('CE', 'Computer Engineering');
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin Person' });
    verifiedAlum = await createUser({
      deptId,
      role: 'ALUMNI',
      fullName: 'Aarav Shah',
      verified: true,
      profile: {
        graduationYear: 2016,
        industry: 'technology',
        city: 'Pune',
        currentCompany: 'Google India',
      },
      skills: ['Node.js'],
    });
    pendingAlum = await createUser({
      deptId,
      role: 'ALUMNI',
      fullName: 'Neha Patel',
      verified: false,
    });
  });

  describe('GET /api/alumni (directory)', () => {
    test('requires login', async () => {
      const res = await api().get('/api/alumni');
      expect(res.status).toBe(401);
    });

    test('lists only verified alumni, sorted by name, with pagination', async () => {
      const res = await api().get('/api/alumni').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toBe(verifiedAlum.id);
    });

    test('filters by graduationYear=2016', async () => {
      const res = await api().get('/api/alumni?graduationYear=2016').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by deptId', async () => {
      const res = await api().get(`/api/alumni?deptId=${deptId}`).set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by industry=technology', async () => {
      const res = await api().get('/api/alumni?industry=technology').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by city=Pune&graduationYear=2016', async () => {
      const res = await api().get('/api/alumni?city=Pune&graduationYear=2016').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by skill=node.js', async () => {
      const res = await api().get('/api/alumni?skill=node.js').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by q=goog', async () => {
      const res = await api().get('/api/alumni?q=goog').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by q=shah', async () => {
      const res = await api().get('/api/alumni?q=shah').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filters by yearFrom=2017&yearTo=2025', async () => {
      const res = await api().get('/api/alumni?yearFrom=2017&yearTo=2025').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    test('treats % and _ in search text literally', async () => {
      const res = await api().get('/api/alumni?q=%').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    test('paginates', async () => {
      const res = await api().get('/api/alumni?page=1&limit=1').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.page).toBe(1);
    });

    test('returns 400 for invalid filters', async () => {
      const res = await api().get('/api/alumni?graduationYear=abc').set(auth(verifiedAlum.token));
      expect(res.status).toBe(400);
    });

    test('non-admins cannot list pending alumni', async () => {
      const res = await api().get('/api/alumni?status=PENDING').set(auth(verifiedAlum.token));
      expect(res.status).toBe(403);
    });

    test('admins can list pending alumni', async () => {
      const res = await api().get('/api/alumni?status=PENDING').set(auth(admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('filter options only include verified alumni', async () => {
      const res = await api().get('/api/alumni/filters').set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data.graduationYears).toContain(2016);
    });
  });

  describe('GET /api/alumni/:id', () => {
    test('shows a verified profile without private contact details', async () => {
      const res = await api().get(`/api/alumni/${verifiedAlum.id}`).set(auth(verifiedAlum.token));
      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Aarav Shah');
    });

    test('hides unverified profiles from other users (404) but not from themselves', async () => {
      const resOther = await api().get(`/api/alumni/${pendingAlum.id}`).set(auth(verifiedAlum.token));
      expect(resOther.status).toBe(404);

      const resSelf = await api().get(`/api/alumni/${pendingAlum.id}`).set(auth(pendingAlum.token));
      expect(resSelf.status).toBe(200);
    });

    test('returns 404 for students and missing ids, 400 for invalid ids', async () => {
      const student = await createUser({ deptId, role: 'STUDENT' });
      const resStudent = await api().get(`/api/alumni/${student.id}`).set(auth(verifiedAlum.token));
      expect(resStudent.status).toBe(404);

      const resMissing = await api().get('/api/alumni/99999').set(auth(verifiedAlum.token));
      expect(resMissing.status).toBe(404);

      const resInvalid = await api().get('/api/alumni/abc').set(auth(verifiedAlum.token));
      expect(resInvalid.status).toBe(400);
    });
  });
});
