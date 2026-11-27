const { api, setupDb, resetDb, closeDb, createDepartment, createUser, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Lecture 16: Modern Authentication Architectures (Access + Refresh Tokens & OAuth2 / OIDC)', () => {
  let deptId;
  let testUser;

  beforeEach(async () => {
    deptId = await createDepartment('CE', 'Computer Engineering');
    testUser = await createUser({ deptId, role: 'ALUMNI', fullName: 'Lecture 16 Alum' });
  });

  describe('1. Dual Token Issuance (Access + Refresh Tokens - Slide 7-12)', () => {
    it('login returns short-lived access token, refresh token and sets HttpOnly cookie', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Verify Set-Cookie header contains HttpOnly refreshToken
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    it('registration returns dual tokens and sets HttpOnly cookie', async () => {
      const res = await api()
        .post('/api/auth/register')
        .send({
          role: 'STUDENT',
          email: 'student.auth@test.com',
          password: 'Password123',
          fullName: 'Fresh Student',
          deptId,
          enrollmentNo: 'ENR-STUD-L16',
          currentSemester: 4,
          expectedGradYear: 2028,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.headers['set-cookie'].some((c) => c.includes('refreshToken='))).toBe(true);
    });
  });

  describe('2. Refresh Flow & Token Rotation (Slide 13-14)', () => {
    it('POST /api/auth/refresh rotates the token and issues new access token', async () => {
      // 1. Initial Login
      const loginRes = await api()
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const initialRefreshToken = loginRes.body.data.refreshToken;
      const initialAccessToken = loginRes.body.data.token;

      // 2. Call Refresh endpoint
      const refreshRes = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.token).toBeDefined();
      expect(refreshRes.body.data.token).not.toEqual(initialAccessToken);
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toEqual(initialRefreshToken);

      // Verify new token works for authenticated requests
      const meRes = await api()
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${refreshRes.body.data.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.email).toBe(testUser.email);
    });

    it('rejects refresh when no token is provided with 401', async () => {
      const res = await api().post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
    });

    it('rejects unknown or invalid refresh token with 401', async () => {
      const res = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_fake_refresh_token_hex_string' });
      expect(res.status).toBe(401);
    });
  });

  describe('3. Replay / Reuse Detection & Family Revocation (Slide 15)', () => {
    it('detects reuse of an old rotated token, revokes the entire token family, and blocks access (403)', async () => {
      // 1. Login
      const loginRes = await api()
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const token1 = loginRes.body.data.refreshToken;

      // 2. Legitimate Refresh (Token 1 -> Token 2)
      const refresh1 = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: token1 });
      expect(refresh1.status).toBe(200);
      const token2 = refresh1.body.data.refreshToken;

      // 3. Replay Attack: Attacker tries to use already-rotated Token 1 again!
      const replayAttempt = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: token1 });

      expect(replayAttempt.status).toBe(403);
      expect(replayAttempt.body.error.message).toMatch(/reuse detected/i);

      // 4. Verification: The active Token 2 in that family has now ALSO been revoked and denied
      const subsequentRefresh = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: token2 });

      expect([401, 403]).toContain(subsequentRefresh.status);
    });
  });

  describe('4. Safe Logout (Slide 16)', () => {
    it('POST /api/auth/logout revokes refresh token and clears cookie', async () => {
      const loginRes = await api()
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const refreshToken = loginRes.body.data.refreshToken;

      // Logout
      const logoutRes = await api()
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data.message).toMatch(/logged out/i);

      // Attempting to refresh with the logged-out token must fail
      const refreshRes = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('5. OAuth 2.0 & OpenID Connect Google Login (Slide 17-21)', () => {
    it('authenticates a new user via Google OIDC identity proof (201)', async () => {
      const googleSub = `google_sub_${Date.now()}`;
      const googleEmail = `dr.asha.sharma.${Date.now()}@google.com`;
      const idToken = `mock_google_token_email=${encodeURIComponent(googleEmail)}&name=Dr%20Asha%20Sharma&sub=${googleSub}`;

      const res = await api()
        .post('/api/auth/oauth/google')
        .send({
          idToken,
          role: 'ALUMNI',
          deptId,
          graduationYear: 2019,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(googleEmail);
      expect(res.body.data.user.role).toBe('ALUMNI');

      // Verify user in database has google_id linked
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [googleEmail]);
      expect(rows[0].google_id).toBe(googleSub);
      expect(rows[0].auth_provider).toBe('GOOGLE');
      expect(rows[0].email_verified).toBe(true);
    });

    it('links Google ID to an existing email account on first Google login (200)', async () => {
      // Existing user registered locally
      const existingEmail = testUser.email;
      const googleSub = `linked_google_${Date.now()}`;
      const idToken = `mock_google_token_email=${encodeURIComponent(existingEmail)}&name=${encodeURIComponent(testUser.fullName)}&sub=${googleSub}`;

      const res = await api()
        .post('/api/auth/oauth/google')
        .send({ idToken });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(existingEmail);

      // Verify Google ID linked in DB
      const { rows } = await pool.query('SELECT google_id, auth_provider FROM users WHERE email = $1', [existingEmail]);
      expect(rows[0].google_id).toBe(googleSub);
      expect(rows[0].auth_provider).toBe('GOOGLE');
    });

    it('rejects a Google account whose email is not verified, so it cannot take over an existing account (401)', async () => {
      const idToken = `mock_google_token_email=${encodeURIComponent(testUser.email)}&sub=unverified_${Date.now()}&verified=false`;

      const res = await api().post('/api/auth/oauth/google').send({ idToken });

      expect(res.status).toBe(401);
      const { rows } = await pool.query('SELECT google_id FROM users WHERE email = $1', [testUser.email]);
      expect(rows[0].google_id).toBeNull();
    });

    it('enforces role authorization: Google accounts do not get admin automatically (Slide 21)', async () => {
      const googleEmail = `regular.alum.${Date.now()}@gmail.com`;
      const idToken = `mock_google_token_email=${encodeURIComponent(googleEmail)}&name=Regular%20Alum&sub=g_${Date.now()}`;

      // 1. Self-registering with ADMIN role is rejected with 400
      const badRoleRes = await api()
        .post('/api/auth/oauth/google')
        .send({ idToken, role: 'ADMIN' });
      expect(badRoleRes.status).toBe(400);

      // 2. Normal OAuth registration gets ALUMNI role
      const authRes = await api()
        .post('/api/auth/oauth/google')
        .send({ idToken, role: 'ALUMNI' });

      expect(authRes.status).toBe(201);
      expect(authRes.body.data.user.role).toBe('ALUMNI');

      // 3. Calling admin-only endpoint with this token must be rejected (403)
      const adminRes = await api()
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${authRes.body.data.token}`);

      expect(adminRes.status).toBe(403);
    });

    it('GET /api/auth/oauth/google provides Google OAuth URL with state parameter', async () => {
      const res = await api()
        .get('/api/auth/oauth/google?format=json&state=custom_csrf_state');

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.body.data.url).toContain('state=custom_csrf_state');
      expect(res.body.data.url).toContain('openid');
    });

    it('rejects simulated Google tokens in production (no login as any email)', async () => {
      const env = require('../src/config/env');
      const oauth = require('../src/modules/auth/oauth.service');
      const realEnv = env.NODE_ENV;
      const realFetch = global.fetch;
      env.NODE_ENV = 'production';
      global.fetch = jest.fn().mockResolvedValue({ ok: false }); // Google rejects the fake token
      try {
        await expect(
          oauth.verifyGoogleIdentity({ idToken: 'mock_google_token_email=admin@alumni.test&sub=attacker' })
        ).rejects.toMatchObject({ status: 401 });
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('oauth2.googleapis.com/tokeninfo'));
      } finally {
        env.NODE_ENV = realEnv;
        global.fetch = realFetch;
      }
    });
  });
});
