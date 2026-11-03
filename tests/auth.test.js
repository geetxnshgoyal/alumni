const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

let deptId;

beforeAll(setupDb);
beforeEach(async () => {
  await resetDb();
  deptId = await createDepartment();
});
afterAll(closeDb);

const alumniBody = () => ({
  role: 'ALUMNI',
  email: 'Asha@Example.com',
  password: 'Secret123',
  fullName: 'Asha Patel',
  deptId,
  enrollmentNo: '2014CE001',
  degree: 'B.E.',
  graduationYear: 2018,
  currentCompany: 'Infosys',
  city: 'Ahmedabad',
  skills: ['Node.js', 'node.js', 'SQL'],
});

describe('POST /api/auth/register', () => {
  test('registers an alumni with profile and skills, returns a token', async () => {
    const res = await api().post('/api/auth/register').send(alumniBody());

    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: 'asha@example.com', // normalised to lower case
      role: 'ALUMNI',
      verificationStatus: 'PENDING',
      deptCode: 'CE',
      skills: ['Node.js', 'SQL'], // duplicates (case-insensitive) removed
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);
  });

  test('registers a student', async () => {
    const res = await api().post('/api/auth/register').send({
      role: 'STUDENT',
      email: 'stud@example.com',
      password: 'Secret123',
      fullName: 'Stu Dent',
      deptId,
      enrollmentNo: '2023CE010',
      currentSemester: 3,
      expectedGradYear: new Date().getFullYear() + 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'STUDENT', currentSemester: 3 });
  });

  test('notifies admins when an alumni registers', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    await api().post('/api/auth/register').send(alumniBody());
    const res = await api().get('/api/notifications').set(auth(admin.token));
    expect(res.body.unread).toBe(1);
    expect(res.body.data[0].type).toBe('ALUMNI_PENDING');
  });

  test('rejects duplicate email with 409', async () => {
    await api().post('/api/auth/register').send(alumniBody());
    const res = await api().post('/api/auth/register').send({ ...alumniBody(), enrollmentNo: 'OTHER1' });
    expect(res.status).toBe(409);
  });

  test('rejects duplicate enrollment number with 409 and saves nothing', async () => {
    await api().post('/api/auth/register').send(alumniBody());
    const res = await api().post('/api/auth/register').send({ ...alumniBody(), email: 'other@example.com' });
    expect(res.status).toBe(409);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    expect(rows[0].n).toBe(1); // transaction rolled back the second user
  });

  test('returns 400 with field details for invalid input', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ ...alumniBody(), email: 'not-an-email', password: 'short', graduationYear: 1800 });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'graduationYear']));
  });

  test('cannot self-register as ADMIN', async () => {
    const res = await api().post('/api/auth/register').send({ ...alumniBody(), role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  test('rejects unknown department', async () => {
    const res = await api().post('/api/auth/register').send({ ...alumniBody(), deptId: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('deptId');
  });

  test('rejects javascript: URLs', async () => {
    const res = await api().post('/api/auth/register').send({ ...alumniBody(), linkedinUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with correct credentials and updates last_login_at', async () => {
    const user = await createUser({ deptId });
    const res = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.lastLoginAt).not.toBeNull();
  });

  test('wrong password and unknown email both return the same 401', async () => {
    const user = await createUser({ deptId });
    const wrong = await api().post('/api/auth/login').send({ email: user.email, password: 'Nope12345' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@test.com', password: 'Nope12345' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  test('locks the account after 5 failed attempts', async () => {
    const user = await createUser({ deptId });
    let res;
    for (let i = 0; i < 5; i += 1) {
      res = await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong1234' });
    }
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/locked/);

    const correct = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(correct.status).toBe(403);
  });

  test('failed logins are written to the audit log', async () => {
    await api().post('/api/auth/login').send({ email: 'ghost@test.com', password: 'Nope12345' });
    const { rows } = await pool.query("SELECT * FROM audit_log WHERE action = 'LOGIN'");
    expect(rows[0]).toMatchObject({ outcome: 'FAILURE', error_code: 'UNKNOWN_EMAIL' });
  });
});

describe('authentication middleware', () => {
  test('rejects requests without a token', async () => {
    const res = await api().get('/api/profile/me');
    expect(res.status).toBe(401);
  });

  test('rejects a tampered token', async () => {
    const user = await createUser({ deptId });
    const res = await api().get('/api/profile/me').set(auth(`${user.token}x`));
    expect(res.status).toBe(401);
  });

  test('rejects tokens of suspended users immediately', async () => {
    const user = await createUser({ deptId });
    await pool.query("UPDATE users SET account_status = 'SUSPENDED' WHERE user_id = $1", [user.id]);
    const res = await api().get('/api/profile/me').set(auth(user.token));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/auth/password', () => {
  test('changes the password', async () => {
    const user = await createUser({ deptId });
    const res = await api()
      .patch('/api/auth/password')
      .set(auth(user.token))
      .send({ currentPassword: user.password, newPassword: 'NewSecret99' });
    expect(res.status).toBe(200);

    const login = await api().post('/api/auth/login').send({ email: user.email, password: 'NewSecret99' });
    expect(login.status).toBe(200);
  });

  test('requires the correct current password', async () => {
    const user = await createUser({ deptId });
    const res = await api()
      .patch('/api/auth/password')
      .set(auth(user.token))
      .send({ currentPassword: 'Wrong1234', newPassword: 'NewSecret99' });
    expect(res.status).toBe(400);
  });
});
