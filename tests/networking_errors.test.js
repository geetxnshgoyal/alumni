const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Networking, Jobs and Events Error Cases (400, 401, 403, 404, 409)', () => {
  let admin, alumni1, alumni2, student1, student2, deptId;

  beforeEach(async () => {
    deptId = await createDepartment();
    admin = await createUser({ role: 'ADMIN', fullName: 'Alice Admin' });
    alumni1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Bob Alumni' });
    alumni2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Charlie Alumni' });
    student1 = await createUser({ deptId, role: 'STUDENT', fullName: 'David Student' });
    student2 = await createUser({ deptId, role: 'STUDENT', fullName: 'Eve Student' });
  });

  // =========================================================================
  // 1. CONNECTIONS API ERROR CASES
  // =========================================================================
  describe('Connections API Error Cases', () => {
    it('400: rejects invalid body fields or non-integer receiver ID', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: 'invalid-id' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('400: rejects invalid connectionType enum value', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni2.id, connectionType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
    });

    it('400: rejects connecting to yourself', async () => {
      const res = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni1.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/cannot connect to yourself/i);
    });

    it('400: rejects invalid query params in GET /api/connections', async () => {
      const res = await api()
        .get('/api/connections?status=NON_EXISTENT_STATUS')
        .set(auth(alumni1.token));

      expect(res.status).toBe(400);
    });

    it('401: requires authentication across all connection endpoints', async () => {
      const postRes = await api().post('/api/connections').send({ receiverId: alumni2.id });
      expect(postRes.status).toBe(401);

      const listRes = await api().get('/api/connections');
      expect(listRes.status).toBe(401);

      const getRes = await api().get('/api/connections/1');
      expect(getRes.status).toBe(401);

      const acceptRes = await api().patch('/api/connections/1/accept');
      expect(acceptRes.status).toBe(401);

      const rejectRes = await api().patch('/api/connections/1/reject');
      expect(rejectRes.status).toBe(401);
    });

    it('403: forbids unauthorized user from viewing or responding to connections', async () => {
      // alumni1 sends request to alumni2
      const connRes = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni2.id });
      const connId = connRes.body.data.connectionId;

      // student1 (third party) cannot view this connection
      const viewRes = await api()
        .get(`/api/connections/${connId}`)
        .set(auth(student1.token));
      expect(viewRes.status).toBe(403);

      // alumni1 (requester) cannot accept their own sent request
      const selfAcceptRes = await api()
        .patch(`/api/connections/${connId}/accept`)
        .set(auth(alumni1.token));
      expect(selfAcceptRes.status).toBe(403);

      // student1 cannot accept this connection
      const thirdAcceptRes = await api()
        .patch(`/api/connections/${connId}/accept`)
        .set(auth(student1.token));
      expect(thirdAcceptRes.status).toBe(403);

      // student1 cannot reject this connection
      const thirdRejectRes = await api()
        .patch(`/api/connections/${connId}/reject`)
        .set(auth(student1.token));
      expect(thirdRejectRes.status).toBe(403);
    });

    it('404: returns 404 for non-existent users or connections', async () => {
      const userNotFound = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: 999999 });
      expect(userNotFound.status).toBe(404);

      const connNotFound = await api()
        .get('/api/connections/999999')
        .set(auth(alumni1.token));
      expect(connNotFound.status).toBe(404);

      const acceptNotFound = await api()
        .patch('/api/connections/999999/accept')
        .set(auth(alumni1.token));
      expect(acceptNotFound.status).toBe(404);

      const rejectNotFound = await api()
        .patch('/api/connections/999999/reject')
        .set(auth(alumni1.token));
      expect(rejectNotFound.status).toBe(404);
    });

    it('409: returns 409 conflict when a connection request already exists', async () => {
      // First request from alumni1 to alumni2
      const first = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni2.id });
      expect(first.status).toBe(201);

      // Duplicate in same direction
      const dup1 = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni2.id });
      expect(dup1.status).toBe(409);
      expect(dup1.body.error.message).toMatch(/already exists/i);

      // Duplicate in reverse direction
      const dup2 = await api()
        .post('/api/connections')
        .set(auth(alumni2.token))
        .send({ receiverId: alumni1.id });
      expect(dup2.status).toBe(409);
      expect(dup2.body.error.message).toMatch(/already exists/i);
    });
  });

  // =========================================================================
  // 2. MESSAGES API ERROR CASES
  // =========================================================================
  describe('Messages API Error Cases', () => {
    let acceptedConn, pendingConn;

    beforeEach(async () => {
      // Accepted connection between alumni1 and alumni2
      const res1 = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: alumni2.id });
      acceptedConn = res1.body.data;
      await api().patch(`/api/connections/${acceptedConn.connectionId}/accept`).set(auth(alumni2.token));

      // Pending connection between alumni1 and student1
      const res2 = await api()
        .post('/api/connections')
        .set(auth(alumni1.token))
        .send({ receiverId: student1.id });
      pendingConn = res2.body.data;
    });

    it('400: rejects missing or invalid connectionId on GET /api/messages', async () => {
      const resMissing = await api()
        .get('/api/messages')
        .set(auth(alumni1.token));
      expect(resMissing.status).toBe(400);

      const resInvalid = await api()
        .get('/api/messages?connectionId=not-a-number')
        .set(auth(alumni1.token));
      expect(resInvalid.status).toBe(400);
    });

    it('400: rejects empty or oversized content on POST /api/messages', async () => {
      const emptyRes = await api()
        .post('/api/messages')
        .set(auth(alumni1.token))
        .send({ connectionId: acceptedConn.connectionId, content: '' });
      expect(emptyRes.status).toBe(400);

      const oversizedRes = await api()
        .post('/api/messages')
        .set(auth(alumni1.token))
        .send({ connectionId: acceptedConn.connectionId, content: 'a'.repeat(5001) });
      expect(oversizedRes.status).toBe(400);
    });

    it('401: requires authentication to send or list messages', async () => {
      const sendRes = await api()
        .post('/api/messages')
        .send({ connectionId: acceptedConn.connectionId, content: 'Hello' });
      expect(sendRes.status).toBe(401);

      const listRes = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`);
      expect(listRes.status).toBe(401);
    });

    it('403: forbids messaging if connection is pending, rejected, or user is not participant', async () => {
      // Pending connection
      const pendingSend = await api()
        .post('/api/messages')
        .set(auth(alumni1.token))
        .send({ connectionId: pendingConn.connectionId, content: 'Hi' });
      expect(pendingSend.status).toBe(403);
      expect(pendingSend.body.error.message).toMatch(/accepted connection/i);

      // Pending list
      const pendingList = await api()
        .get(`/api/messages?connectionId=${pendingConn.connectionId}`)
        .set(auth(alumni1.token));
      expect(pendingList.status).toBe(403);

      // Non-participant
      const thirdPartySend = await api()
        .post('/api/messages')
        .set(auth(student2.token))
        .send({ connectionId: acceptedConn.connectionId, content: 'Eavesdropping' });
      expect(thirdPartySend.status).toBe(403);

      const thirdPartyList = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`)
        .set(auth(student2.token));
      expect(thirdPartyList.status).toBe(403);
    });

    it('404: returns 404 when connection does not exist', async () => {
      const sendRes = await api()
        .post('/api/messages')
        .set(auth(alumni1.token))
        .send({ connectionId: 999999, content: 'Lost in the void' });
      expect(sendRes.status).toBe(404);

      const listRes = await api()
        .get('/api/messages?connectionId=999999')
        .set(auth(alumni1.token));
      expect(listRes.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. JOBS & APPLICATIONS API ERROR CASES
  // =========================================================================
  describe('Jobs and Applications API Error Cases', () => {
    let openJob, closedJob;

    beforeEach(async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'Cloud Architect',
          companyName: 'SkyTech',
          location: 'Bengaluru',
          jobType: 'FULL_TIME',
          description: 'Design distributed cloud native systems.',
        });
      openJob = res.body.data;

      const res2 = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: 'DevOps Engineer',
          companyName: 'CloudNet',
          location: 'Remote',
          jobType: 'CONTRACT',
          description: 'Terraform and Kubernetes pipeline management.',
        });
      closedJob = res2.body.data;
      await api().patch(`/api/jobs/${closedJob.jobId}/close`).set(auth(alumni1.token));
    });

    it('400: rejects invalid job post fields and malformed IDs', async () => {
      const res = await api()
        .post('/api/jobs')
        .set(auth(alumni1.token))
        .send({
          title: '',
          companyName: 'Missing other fields',
        });
      expect(res.status).toBe(400);

      const invalidParam = await api()
        .get('/api/jobs/not-an-id');
      expect(invalidParam.status).toBe(400);
    });

    it('400: rejects applying to a closed job post', async () => {
      const res = await api()
        .post(`/api/jobs/${closedJob.jobId}/apply`)
        .set(auth(student1.token))
        .send({ coverNote: 'Interested in this role' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/closed or inactive/i);
    });

    it('401: requires authentication to post, update, close, or apply to jobs', async () => {
      const postRes = await api().post('/api/jobs').send({ title: 'Test' });
      expect(postRes.status).toBe(401);

      const closeRes = await api().patch(`/api/jobs/${openJob.jobId}/close`);
      expect(closeRes.status).toBe(401);

      const applyRes = await api().post(`/api/jobs/${openJob.jobId}/apply`).send({});
      expect(applyRes.status).toBe(401);

      const myAppsRes = await api().get('/api/applications/my');
      expect(myAppsRes.status).toBe(401);
    });

    it('403: forbids student from posting jobs or non-owner from closing jobs', async () => {
      const postStudent = await api()
        .post('/api/jobs')
        .set(auth(student1.token))
        .send({
          title: 'Student Job',
          companyName: 'Student Inc',
          location: 'Delhi',
          jobType: 'INTERNSHIP',
          description: 'Not allowed for students',
        });
      expect(postStudent.status).toBe(403);

      const closeOther = await api()
        .patch(`/api/jobs/${openJob.jobId}/close`)
        .set(auth(alumni2.token));
      expect(closeOther.status).toBe(403);
    });

    it('403: forbids unauthorized user from reviewing candidates or updating status', async () => {
      // student1 applies to openJob
      const appRes = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(student1.token))
        .send({ coverNote: 'Hire me!' });
      const appId = appRes.body.data.applicationId;

      // alumni2 (not the poster, not admin) cannot view applications
      const viewApps = await api()
        .get(`/api/jobs/${openJob.jobId}/applications`)
        .set(auth(alumni2.token));
      expect(viewApps.status).toBe(403);

      // alumni2 cannot change application status
      const updateStatus = await api()
        .patch(`/api/applications/${appId}/status`)
        .set(auth(alumni2.token))
        .send({ status: 'SHORTLISTED' });
      expect(updateStatus.status).toBe(403);
    });

    it('404: returns 404 for non-existent jobs or applications', async () => {
      const job404 = await api().get('/api/jobs/999999');
      expect(job404.status).toBe(404);

      const close404 = await api()
        .patch('/api/jobs/999999/close')
        .set(auth(admin.token));
      expect(close404.status).toBe(404);

      const apply404 = await api()
        .post('/api/jobs/999999/apply')
        .set(auth(student1.token))
        .send({});
      expect(apply404.status).toBe(404);

      const appStatus404 = await api()
        .patch('/api/applications/999999/status')
        .set(auth(admin.token))
        .send({ status: 'SHORTLISTED' });
      expect(appStatus404.status).toBe(404);
    });

    it('409: returns 409 conflict when applying multiple times to same job', async () => {
      const app1 = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(student1.token))
        .send({ coverNote: 'First attempt' });
      expect(app1.status).toBe(201);

      const app2 = await api()
        .post(`/api/jobs/${openJob.jobId}/apply`)
        .set(auth(student1.token))
        .send({ coverNote: 'Second attempt' });
      expect(app2.status).toBe(409);
      expect(app2.body.error.message).toMatch(/already applied/i);
    });
  });

  // =========================================================================
  // 4. EVENTS API ERROR CASES
  // =========================================================================
  describe('Events API Error Cases', () => {
    let draftEvent, openEvent;

    beforeEach(async () => {
      // Draft event
      const resDraft = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Planning Session',
          description: 'Internal planning draft',
          eventType: 'REUNION',
          mode: 'OFFLINE',
          venueOrLink: 'Campus Room 101',
          startAt: '2026-12-20T10:00:00Z',
          endAt: '2026-12-20T12:00:00Z',
          capacity: 20,
          status: 'DRAFT',
        });
      draftEvent = resDraft.body.data;

      // Open event
      const resOpen = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Alumni Hackathon 2026',
          description: 'Annual hackathon competition',
          eventType: 'WORKSHOP',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us/j/alumni-hackathon',
          startAt: '2026-12-18T09:00:00Z',
          endAt: '2026-12-19T18:00:00Z',
          capacity: 2,
          registrationDeadline: '2026-12-17T23:59:59Z',
          status: 'OPEN',
        });
      openEvent = resOpen.body.data;
    });

    it('400: rejects invalid event dates and capacity', async () => {
      const resEndBeforeStart = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Invalid Event',
          description: 'End before start',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us',
          startAt: '2026-12-25T14:00:00Z',
          endAt: '2026-12-25T10:00:00Z',
          capacity: 10,
        });
      expect(resEndBeforeStart.status).toBe(400);

      const resNegativeCap = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Invalid Capacity',
          description: 'Negative capacity',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us',
          startAt: '2026-12-25T10:00:00Z',
          endAt: '2026-12-25T14:00:00Z',
          capacity: -5,
        });
      expect(resNegativeCap.status).toBe(400);
    });

    it('400: rejects registering for non-open event or past registration deadline', async () => {
      // Cannot register for draft event
      const regDraft = await api()
        .post(`/api/events/${draftEvent.eventId}/register`)
        .set(auth(alumni1.token));
      expect(regDraft.status).toBe(400);
      expect(regDraft.body.error.message).toMatch(/not open/i);

      // Create an event with past deadline
      const pastDeadlineEventRes = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Expired Deadline Event',
          description: 'Deadline is in past',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us',
          startAt: '2026-12-28T10:00:00Z',
          endAt: '2026-12-28T12:00:00Z',
          capacity: 50,
          registrationDeadline: '2020-01-01T00:00:00Z', // Past deadline
          status: 'OPEN',
        });
      const pastDeadlineEvent = pastDeadlineEventRes.body.data;

      const regPast = await api()
        .post(`/api/events/${pastDeadlineEvent.eventId}/register`)
        .set(auth(alumni1.token));
      expect(regPast.status).toBe(400);
      expect(regPast.body.error.message).toMatch(/deadline has passed/i);
    });

    it('401: requires authentication to register, cancel or manage events', async () => {
      const createRes = await api().post('/api/events').send({});
      expect(createRes.status).toBe(401);

      const regRes = await api().post(`/api/events/${openEvent.eventId}/register`);
      expect(regRes.status).toBe(401);

      const cancelRes = await api().delete(`/api/events/${openEvent.eventId}/register`);
      expect(cancelRes.status).toBe(401);

      const rosterRes = await api().get(`/api/events/${openEvent.eventId}/registrations`);
      expect(rosterRes.status).toBe(401);
    });

    it('403: forbids non-admin users from creating events or viewing attendee roster', async () => {
      const createAlumni = await api()
        .post('/api/events')
        .set(auth(alumni1.token))
        .send({
          title: 'Alumni Created Event',
          description: 'Not allowed',
          eventType: 'REUNION',
          mode: 'OFFLINE',
          venueOrLink: 'Venue',
          startAt: '2026-12-20T10:00:00Z',
          endAt: '2026-12-20T12:00:00Z',
          capacity: 10,
        });
      expect(createAlumni.status).toBe(403);

      const rosterStudent = await api()
        .get(`/api/events/${openEvent.eventId}/registrations`)
        .set(auth(student1.token));
      expect(rosterStudent.status).toBe(403);
    });

    it('404: returns 404 for non-existent events or cancel on un-registered event', async () => {
      const get404 = await api().get('/api/events/999999');
      expect(get404.status).toBe(404);

      const reg404 = await api()
        .post('/api/events/999999/register')
        .set(auth(alumni1.token));
      expect(reg404.status).toBe(404);

      // Cancel registration when not registered
      const cancelNotReg = await api()
        .delete(`/api/events/${openEvent.eventId}/register`)
        .set(auth(alumni1.token));
      expect(cancelNotReg.status).toBe(404);
      expect(cancelNotReg.body.error.message).toMatch(/active registration not found/i);
    });

    it('409: returns 409 conflict when registering twice for the same event', async () => {
      const reg1 = await api()
        .post(`/api/events/${openEvent.eventId}/register`)
        .set(auth(alumni1.token));
      expect(reg1.status).toBe(201);
      expect(reg1.body.data.regStatus).toBe('REGISTERED');

      const reg2 = await api()
        .post(`/api/events/${openEvent.eventId}/register`)
        .set(auth(alumni1.token));
      expect(reg2.status).toBe(409);
      expect(reg2.body.error.message).toMatch(/already registered/i);
    });
  });
});
