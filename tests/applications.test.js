const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Job Applications API', () => {
  let poster, applicant1, applicant2, otherUser, admin, openJob, closedJob;

  beforeEach(async () => {
    const deptId = await createDepartment();
    poster = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alice Poster' });
    applicant1 = await createUser({ deptId, role: 'STUDENT', fullName: 'Bob Student' });
    applicant2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Charlie Alumni' });
    otherUser = await createUser({ deptId, role: 'STUDENT', fullName: 'Dave Stranger' });
    admin = await createUser({ role: 'ADMIN', fullName: 'Emma Admin' });

    // Create an open job post
    const resOpen = await api()
      .post('/api/jobs')
      .set(auth(poster.token))
      .send({
        title: 'Full Stack Engineer',
        companyName: 'Tech Innovators',
        location: 'Remote',
        jobType: 'FULL_TIME',
        description: 'Join our fast-growing engineering team.',
        applyBy: '2026-12-31',
      });
    openJob = resOpen.body.data;

    // Create a closed job post
    const resClosed = await api()
      .post('/api/jobs')
      .set(auth(poster.token))
      .send({
        title: 'Closed Position',
        companyName: 'Legacy Systems',
        location: 'New York, NY',
        jobType: 'CONTRACT',
        description: 'Position is already filled.',
      });
    closedJob = resClosed.body.data;
    await api().patch(`/api/jobs/${closedJob.jobId}/close`).set(auth(poster.token));
  });

  describe('POST /api/jobs/:id/apply (apply to job)', () => {
    it('allows a student to apply with resumeUrl and coverNote (201)', async () => {
      const res = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({
          resumeUrl: 'https://example.com/resumes/bob.pdf',
          coverNote: 'I have extensive experience with Node.js and PostgreSQL.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.applicationId).toBeDefined();
      expect(res.body.data.jobId).toBe(openJob.jobId);
      expect(res.body.data.applicantId).toBe(applicant1.id);
      expect(res.body.data.resumeUrl).toBe('https://example.com/resumes/bob.pdf');
      expect(res.body.data.coverNote).toBe('I have extensive experience with Node.js and PostgreSQL.');
      expect(res.body.data.status).toBe('APPLIED');
      expect(res.body.data.appliedAt).toBeDefined();
    });

    it('allows an alumni to apply without resumeUrl or coverNote (201)', async () => {
      const res = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant2.token))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.applicationId).toBeDefined();
      expect(res.body.data.applicantId).toBe(applicant2.id);
      expect(res.body.data.status).toBe('APPLIED');
      expect(res.body.data.resumeUrl).toBeNull();
      expect(res.body.data.coverNote).toBeNull();
    });

    it('rejects repeat applications with 409 conflict', async () => {
      // First application
      const first = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({ coverNote: 'First application' });
      expect(first.status).toBe(201);

      // Repeat application
      const repeat = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({ coverNote: 'Trying again' });

      expect(repeat.status).toBe(409);
      expect(repeat.body.error.message).toMatch(/already applied/i);
    });

    it('rejects applications to closed jobs with 400', async () => {
      const res = await api()
        .post(`/api/jobs/${closedJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({ coverNote: 'Applying to closed job' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/closed/i);
    });

    it('requires authentication (401)', async () => {
      const res = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .send({ coverNote: 'No token' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when applying to non-existent job', async () => {
      const res = await api()
        .post('/api/jobs/999999/apply')
        .set(auth(applicant1.token))
        .send({ coverNote: 'Ghost job' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('rejects invalid resumeUrl with 400', async () => {
      const res = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({ resumeUrl: 'not-a-valid-url' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });
  });

  describe('PATCH /api/applications/:id/status (update status & notify)', () => {
    let application;

    beforeEach(async () => {
      const res = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({
          resumeUrl: 'https://example.com/resumes/bob.pdf',
          coverNote: 'Excited about this opportunity!',
        });
      application = res.body.data;
    });

    it('allows the job poster to update status to SHORTLISTED and notifies applicant (200)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(poster.token))
        .send({ status: 'SHORTLISTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationId).toBe(application.applicationId);
      expect(res.body.data.status).toBe('SHORTLISTED');

      // Verify applicant received notification
      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [applicant1.id, 'JOB_APPLICATION']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('SHORTLISTED');
      expect(rows[0].body).toContain(openJob.title);
      expect(rows[0].link_url).toBe(`#/jobs/${openJob.jobId}`);
      expect(rows[0].is_read).toBe(false);
    });

    it('allows the job poster to update status to HIRED and notifies applicant (200)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(poster.token))
        .send({ status: 'HIRED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('HIRED');

      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [applicant1.id, 'JOB_APPLICATION']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('HIRED');
    });

    it('allows an admin to update status and notifies applicant (200)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(admin.token))
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');

      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [applicant1.id, 'JOB_APPLICATION']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('REJECTED');
    });

    it('forbids the applicant from updating their own status (403)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(applicant1.token))
        .send({ status: 'HIRED' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the job poster or an admin/i);
    });

    it('forbids another user from updating application status (403)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(otherUser.token))
        .send({ status: 'SHORTLISTED' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the job poster or an admin/i);
    });

    it('requires authentication (401)', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .send({ status: 'SHORTLISTED' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when updating non-existent application', async () => {
      const res = await api()
        .patch('/api/applications/999999/status')
        .set(auth(poster.token))
        .send({ status: 'SHORTLISTED' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('rejects invalid status value with 400', async () => {
      const res = await api()
        .patch(`/api/applications/${application.applicationId}/status`)
        .set(auth(poster.token))
        .send({ status: 'PENDING' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });
  });

  describe('GET /api/jobs/:id/applications & GET /api/applications/me', () => {
    let app1, app2;

    beforeEach(async () => {
      const res1 = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant1.token))
        .send({ coverNote: 'Bob application' });
      app1 = res1.body.data;

      const res2 = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(applicant2.token))
        .send({ coverNote: 'Charlie application' });
      app2 = res2.body.data;
    });

    it('allows job poster to list applications for their job (200)', async () => {
      const res = await api()
        .get(`/api/jobs/${openJob.jobId}/applications`)
        .set(auth(poster.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('forbids other users from viewing job applications (403)', async () => {
      const res = await api()
        .get(`/api/jobs/${openJob.jobId}/applications`)
        .set(auth(otherUser.token));

      expect(res.status).toBe(403);
    });

    it('allows applicant to list their own applications (200)', async () => {
      const res = await api()
        .get('/api/applications/me')
        .set(auth(applicant1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].applicationId).toBe(app1.applicationId);
    });

    it('allows applicant, poster, and admin to view single application by ID (200)', async () => {
      // Applicant can view
      const resApplicant = await api()
        .get(`/api/applications/${app1.applicationId}`)
        .set(auth(applicant1.token));
      expect(resApplicant.status).toBe(200);
      expect(resApplicant.body.data.applicationId).toBe(app1.applicationId);

      // Poster can view
      const resPoster = await api()
        .get(`/api/applications/${app1.applicationId}`)
        .set(auth(poster.token));
      expect(resPoster.status).toBe(200);

      // Admin can view
      const resAdmin = await api()
        .get(`/api/applications/${app1.applicationId}`)
        .set(auth(admin.token));
      expect(resAdmin.status).toBe(200);

      // Other user cannot view
      const resOther = await api()
        .get(`/api/applications/${app1.applicationId}`)
        .set(auth(otherUser.token));
      expect(resOther.status).toBe(403);
    });
  });
});
