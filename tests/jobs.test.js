const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Jobs API', () => {
  let alumni1, alumni2, student, admin;

  beforeEach(async () => {
    const deptId = await createDepartment();
    alumni1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alice Tech' });
    alumni2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Bob Dev' });
    student = await createUser({ deptId, role: 'STUDENT', fullName: 'Charlie Junior' });
    admin = await createUser({ role: 'ADMIN', fullName: 'Admin Chief' });
  });

  describe('POST /api/jobs (create job post)', () => {
    it('allows an alumni to create a job post (201)', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Software Engineer',
          companyName: 'Acme Corp',
          location: 'San Francisco, CA',
          jobType: 'FULL_TIME',
          description: 'Build high-scale distributed systems.',
          applyBy: '2026-12-31',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.postedBy).toBe(alumni1.id);
      expect(res.body.data.title).toBe('Software Engineer');
      expect(res.body.data.companyName).toBe('Acme Corp');
      expect(res.body.data.location).toBe('San Francisco, CA');
      expect(res.body.data.jobType).toBe('FULL_TIME');
      expect(res.body.data.description).toBe('Build high-scale distributed systems.');
      expect(res.body.data.applyBy).toBe('2026-12-31');
      expect(res.body.data.status).toBe('OPEN');
    });

    it('allows an admin to create a job post without applyBy (201)', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(admin.token))
        .send({
          title: 'Frontend Intern',
          companyName: 'Startup Inc',
          location: 'Remote',
          jobType: 'INTERNSHIP',
          description: 'Work with React and Tailwind CSS.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.postedBy).toBe(admin.id);
      expect(res.body.data.jobType).toBe('INTERNSHIP');
      expect(res.body.data.applyBy).toBeNull();
    });

    it('forbids a student from posting a job (403)', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(student.token))
        .send({
          title: 'Junior Developer',
          companyName: 'Junior Co',
          location: 'New York, NY',
          jobType: 'FULL_TIME',
          description: 'Entry-level position.',
        });

      expect(res.status).toBe(403);
    });

    it('requires authentication (401)', async () => {
      const res = await api()
        .post('/api/jobs')
        .send({
          title: 'DevOps Engineer',
          companyName: 'Cloud Co',
          location: 'Remote',
          jobType: 'CONTRACT',
          description: 'Manage AWS infrastructure.',
        });

      expect(res.status).toBe(401);
    });

    it('rejects missing required fields with 400', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Software Engineer',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('rejects invalid jobType with 400', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'QA Engineer',
          companyName: 'Quality Corp',
          location: 'Austin, TX',
          jobType: 'PART_TIME',
          description: 'Manual and automated testing.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('rejects invalid applyBy date format with 400', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Data Analyst',
          companyName: 'Analytics Ltd',
          location: 'Chicago, IL',
          jobType: 'FULL_TIME',
          description: 'Analyze user behavior data.',
          applyBy: '31-12-2026',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
      expect(res.body.error.details.some((d) => /YYYY-MM-DD/i.test(d.message))).toBe(true);
    });
  });

  describe('GET /api/jobs (list and search jobs)', () => {
    let job1, job2, job3, closedJob;

    beforeEach(async () => {
      const res1 = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Senior Backend Engineer',
          companyName: 'Stripe',
          location: 'San Francisco, CA',
          jobType: 'FULL_TIME',
          description: 'Design payments infrastructure in Node.js and Go.',
        });
      job1 = res1.body.data;

      const res2 = await api()
        .post('/api/jobs')
        .set(auth(alumni2.token))
        .send({
          title: 'Machine Learning Intern',
          companyName: 'Google',
          location: 'Mountain View, CA',
          jobType: 'INTERNSHIP',
          description: 'Train deep learning models for vision systems.',
        });
      job2 = res2.body.data;

      const res3 = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'DevOps Contractor',
          companyName: 'Netflix',
          location: 'Remote',
          jobType: 'CONTRACT',
          description: 'Kubernetes cluster administration and cloud migration.',
        });
      job3 = res3.body.data;

      const res4 = await api()
        .post('/api/jobs')
        .set(auth(admin.token))
        .send({
          title: 'Archived Job',
          companyName: 'Old Co',
          location: 'Remote',
          jobType: 'FULL_TIME',
          description: 'Old closed position.',
        });
      closedJob = res4.body.data;
      await api().patch(`/api/jobs/${closedJob.jobId}/close`).set(auth(admin.token));
    });

    it('lists all jobs with pagination metadata (200, public)', async () => {
      const res = await api().get('/api/jobs');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(4);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(4);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.meta).toBeDefined();
    });

    it('filters jobs by job type', async () => {
      const res = await api().get('/api/jobs?type=INTERNSHIP');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].jobId).toBe(job2.jobId);
      expect(res.body.data[0].jobType).toBe('INTERNSHIP');
    });

    it('filters jobs by location (case-insensitive partial match)', async () => {
      const res = await api().get('/api/jobs?location=remote');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((j) => j.location.toLowerCase().includes('remote'))).toBe(true);
    });

    it('filters jobs by status (OPEN vs CLOSED)', async () => {
      const resOpen = await api().get('/api/jobs?status=OPEN');
      expect(resOpen.status).toBe(200);
      expect(resOpen.body.data).toHaveLength(3);
      expect(resOpen.body.data.every((j) => j.status === 'OPEN')).toBe(true);

      const resClosed = await api().get('/api/jobs?status=CLOSED');
      expect(resClosed.status).toBe(200);
      expect(resClosed.body.data).toHaveLength(1);
      expect(resClosed.body.data[0].jobId).toBe(closedJob.jobId);
    });

    it('searches jobs with query param q (title, company, or description)', async () => {
      const resTitle = await api().get('/api/jobs?q=Backend');
      expect(resTitle.status).toBe(200);
      expect(resTitle.body.data).toHaveLength(1);
      expect(resTitle.body.data[0].jobId).toBe(job1.jobId);

      const resCompany = await api().get('/api/jobs?q=Google');
      expect(resCompany.status).toBe(200);
      expect(resCompany.body.data).toHaveLength(1);
      expect(resCompany.body.data[0].companyName).toBe('Google');

      const resDesc = await api().get('/api/jobs?q=Kubernetes');
      expect(resDesc.status).toBe(200);
      expect(resDesc.body.data).toHaveLength(1);
      expect(resDesc.body.data[0].jobId).toBe(job3.jobId);
    });

    it('supports pagination limit and page', async () => {
      const res = await api().get('/api/jobs?limit=2&page=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(4);
      expect(res.body.pagination.totalPages).toBe(2);

      const resPage2 = await api().get('/api/jobs?limit=2&page=2');
      expect(resPage2.status).toBe(200);
      expect(resPage2.body.data).toHaveLength(2);
    });

    it('rejects invalid query parameters with 400', async () => {
      const res = await api().get('/api/jobs?type=UNKNOWN_TYPE');
      expect(res.status).toBe(400);

      const resBadPage = await api().get('/api/jobs?page=0');
      expect(resBadPage.status).toBe(400);
    });
  });

  describe('GET /api/jobs/:id (get single job post)', () => {
    let job;

    beforeEach(async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Full Stack Engineer',
          companyName: 'OpenAI',
          location: 'San Francisco, CA',
          jobType: 'FULL_TIME',
          description: 'Work on cutting edge LLM interfaces.',
          applyBy: '2026-11-30',
        });
      job = res.body.data;
    });

    it('returns the job details including poster info (200, public)', async () => {
      const res = await api().get(`/api/jobs/${job.jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe(job.jobId);
      expect(res.body.data.title).toBe('Full Stack Engineer');
      expect(res.body.data.companyName).toBe('OpenAI');
      expect(res.body.data.posterName).toBe('Alice Tech');
      expect(res.body.data.posterEmail).toBe(alumni1.email);
      expect(res.body.data.posterRole).toBe('ALUMNI');
    });

    it('returns 404 when job does not exist', async () => {
      const res = await api().get('/api/jobs/999999');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('returns 400 for invalid id param', async () => {
      const res = await api().get('/api/jobs/abc');

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/jobs/:id (update job post)', () => {
    let job;

    beforeEach(async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Backend Engineer',
          companyName: 'Tech Startup',
          location: 'Seattle, WA',
          jobType: 'FULL_TIME',
          description: 'Node.js developer needed.',
        });
      job = res.body.data;
    });

    it('allows the job poster to update job details (200)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(alumni1.token))
        .send({
          title: 'Lead Backend Engineer',
          location: 'Remote',
          jobType: 'CONTRACT',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Lead Backend Engineer');
      expect(res.body.data.location).toBe('Remote');
      expect(res.body.data.jobType).toBe('CONTRACT');
      expect(res.body.data.companyName).toBe('Tech Startup');
    });

    it('allows an admin to update any job post (200)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(admin.token))
        .send({
          companyName: 'Updated Tech Corp',
          description: 'Updated description by admin.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe('Updated Tech Corp');
      expect(res.body.data.description).toBe('Updated description by admin.');
    });

    it('forbids a different alumni from updating the job post (403)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(alumni2.token))
        .send({
          title: 'Hacked Title',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the job poster or an admin/i);
    });

    it('forbids a student from updating the job post (403)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(student.token))
        .send({
          title: 'Hacked Title',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only the job poster or an admin/i);
    });

    it('requires authentication (401)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .send({
          title: 'New Title',
        });

      expect(res.status).toBe(401);
    });

    it('returns 404 when updating non-existent job post', async () => {
      const res = await api()
        .patch('/api/jobs/999999')
        .set(auth(admin.token))
        .send({
          title: 'New Title',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('rejects empty update body with 400', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(alumni1.token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
      expect(res.body.error.details.some((d) => /at least one field/i.test(d.message))).toBe(true);
    });

    it('rejects unrecognized extra fields (.strict) with 400', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}`)
        .set(auth(alumni1.token))
        .send({
          randomProperty: 'notAllowed',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });
  });

  describe('PATCH /api/jobs/:id/close (close job post)', () => {
    let job;

    beforeEach(async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Frontend Developer',
          companyName: 'Web Solutions',
          location: 'Boston, MA',
          jobType: 'FULL_TIME',
          description: 'Frontend role with Vue/React.',
        });
      job = res.body.data;
    });

    it('allows the poster to close the job post and logs to audit_log (200)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}/close`)
        .set(auth(alumni1.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');

      // Verify audit_log entry
      const { rows } = await pool.query(
        'SELECT * FROM audit_log WHERE action = $1 AND entity_id = $2',
        ['JOB_CLOSE', job.jobId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_id).toBe(alumni1.id);
      expect(rows[0].entity_name).toBe('job_post');
      expect(rows[0].outcome).toBe('SUCCESS');
    });

    it('allows an admin to close any job post and logs to audit_log (200)', async () => {
      const res = await api()
        .patch(`/api/jobs/${job.jobId}/close`)
        .set(auth(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');

      const { rows } = await pool.query(
        'SELECT * FROM audit_log WHERE action = $1 AND entity_id = $2',
        ['JOB_CLOSE', job.jobId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_id).toBe(admin.id);
    });

    it('forbids another user from closing the job post (403)', async () => {
      const resAlumni2 = await api()
        .patch(`/api/jobs/${job.jobId}/close`)
        .set(auth(alumni2.token));

      expect(resAlumni2.status).toBe(403);
      expect(resAlumni2.body.error.message).toMatch(/only the job poster or an admin/i);

      const resStudent = await api()
        .patch(`/api/jobs/${job.jobId}/close`)
        .set(auth(student.token));

      expect(resStudent.status).toBe(403);
      expect(resStudent.body.error.message).toMatch(/only the job poster or an admin/i);
    });

    it('requires authentication (401)', async () => {
      const res = await api().patch(`/api/jobs/${job.jobId}/close`);

      expect(res.status).toBe(401);
    });

    it('returns 404 when closing non-existent job post', async () => {
      const res = await api()
        .patch('/api/jobs/999999/close')
        .set(auth(admin.token));

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });
  });
});
