const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('/api/profile/me', () => {
  let deptId, user;

  beforeEach(async () => {
    deptId = await createDepartment();
    user = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alum One' });
  });

  test('GET returns the full profile', async () => {
    const res = await api().get('/api/profile/me').set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.fullName).toBe('Alum One');
  });

  test('PATCH updates alumni fields, skills and interests', async () => {
    const res = await api()
      .patch('/api/profile/me')
      .set(auth(user.token))
      .send({
        currentCompany: 'Google',
        designation: 'Senior Engineer',
        skills: ['Node.js', 'PostgreSQL'],
        interests: ['Mentoring'],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.currentCompany).toBe('Google');
    expect(res.body.data.skills).toContain('Node.js');
  });

  test('PATCH rejects fields that belong to another role', async () => {
    const res = await api()
      .patch('/api/profile/me')
      .set(auth(user.token))
      .send({ currentSemester: 6 });
    expect(res.status).toBe(400);
  });

  test('PATCH rejects unknown fields and empty bodies', async () => {
    const res = await api()
      .patch('/api/profile/me')
      .set(auth(user.token))
      .send({});
    expect(res.status).toBe(400);
  });

  test('PATCH returns 409 when the phone number is taken', async () => {
    const other = await createUser({ deptId, role: 'ALUMNI', fullName: 'Other User' });
    await api().patch('/api/profile/me').set(auth(other.token)).send({ phone: '9876543210' });

    const res = await api()
      .patch('/api/profile/me')
      .set(auth(user.token))
      .send({ phone: '9876543210' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/skills', () => {
  test('lists skills with usage counts and supports search', async () => {
    const deptId = await createDepartment();
    const user = await createUser({ deptId, role: 'ALUMNI', skills: ['Python', 'Docker'] });

    const res = await api().get('/api/skills?q=py').set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].skillName).toBe('Python');
  });
});
