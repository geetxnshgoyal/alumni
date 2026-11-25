const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Events API', () => {
  let admin, alumni1, alumni2, student1, student2;

  beforeEach(async () => {
    const deptId = await createDepartment();
    admin = await createUser({ role: 'ADMIN', fullName: 'Alice Admin' });
    alumni1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Bob Alumni' });
    alumni2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Charlie Alumni' });
    student1 = await createUser({ deptId, role: 'STUDENT', fullName: 'David Student' });
    student2 = await createUser({ deptId, role: 'STUDENT', fullName: 'Eve Student' });
  });

  describe('Admin Events Management & Validation (B5)', () => {
    it('allows an admin to create an event in DRAFT or OPEN status (201)', async () => {
      const res = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Annual Alumni Gala 2026',
          description: 'Grand reunion dinner and networking celebration.',
          eventType: 'REUNION',
          mode: 'OFFLINE',
          venueOrLink: 'Grand Ballroom, Campus Center',
          startAt: '2026-12-15T18:00:00Z',
          endAt: '2026-12-15T22:00:00Z',
          capacity: 150,
          registrationDeadline: '2026-12-10T23:59:59Z',
          status: 'DRAFT',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.eventId).toBeDefined();
      expect(res.body.data.title).toBe('Annual Alumni Gala 2026');
      expect(res.body.data.eventType).toBe('REUNION');
      const logged = (await pool.query("SELECT action, outcome, error_code FROM audit_log WHERE action = $1", ['EVENT_CREATE'])).rows;
      expect(logged).toHaveLength(1);
      expect(res.body.data.mode).toBe('OFFLINE');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.capacity).toBe(150);
    });

    it('forbids non-admin users from creating events (403)', async () => {
      const res = await api()
        .post('/api/events')
        .set(auth(alumni1.token))
        .send({
          title: 'Tech Talk',
          description: 'A deep dive into distributed systems.',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://meet.google.com/abc-defg-hij',
          startAt: '2026-12-01T10:00:00Z',
          endAt: '2026-12-01T12:00:00Z',
          capacity: 50,
        });

      expect(res.status).toBe(403);
    });

    it('requires authentication to create an event (401)', async () => {
      const res = await api()
        .post('/api/events')
        .send({
          title: 'Unauthorized Event',
          description: 'Should fail',
          eventType: 'WORKSHOP',
          mode: 'ONLINE',
          venueOrLink: 'https://example.com',
          startAt: '2026-12-01T10:00:00Z',
          endAt: '2026-12-01T12:00:00Z',
          capacity: 10,
        });

      expect(res.status).toBe(401);
    });

    it('rejects event creation when endAt is before or equal to startAt (400)', async () => {
      const res = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Invalid Date Event',
          description: 'Dates are backwards.',
          eventType: 'WORKSHOP',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us/j/123456',
          startAt: '2026-12-05T18:00:00Z',
          endAt: '2026-12-05T17:00:00Z', // Before startAt
          capacity: 30,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
      expect(res.body.error.details.some((d) => /after start date/i.test(d.message))).toBe(true);
    });

    it('rejects event creation when registrationDeadline is after startAt (400)', async () => {
      const res = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Invalid Deadline Event',
          description: 'Deadline is after event starts.',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://zoom.us/j/123456',
          startAt: '2026-12-05T14:00:00Z',
          endAt: '2026-12-05T16:00:00Z',
          capacity: 40,
          registrationDeadline: '2026-12-05T18:00:00Z', // After startAt
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
      expect(res.body.error.details.some((d) => /on or before event start date/i.test(d.message))).toBe(true);
    });

    it('enforces status flow: DRAFT -> OPEN -> COMPLETED/CANCELLED', async () => {
      // 1. Create event in DRAFT
      const createRes = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Career Fair 2026',
          description: 'Annual campus job fair.',
          eventType: 'WORKSHOP',
          mode: 'OFFLINE',
          venueOrLink: 'Campus Auditorium',
          startAt: '2026-12-20T09:00:00Z',
          endAt: '2026-12-20T17:00:00Z',
          capacity: 100,
          status: 'DRAFT',
        });
      const eventId = createRes.body.data.eventId;

      // 2. Cannot jump directly from DRAFT to COMPLETED (400)
      const badJump = await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(admin.token))
        .send({ status: 'COMPLETED' });
      expect(badJump.status).toBe(400);
      expect(badJump.body.error.message).toMatch(/cannot transition event status/i);

      // 3. Transition DRAFT -> OPEN (200)
      const openRes = await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(admin.token))
        .send({ status: 'OPEN' });
      expect(openRes.status).toBe(200);
      expect(openRes.body.data.status).toBe('OPEN');

      // 4. Cannot transition back from OPEN -> DRAFT (400)
      const backToDraft = await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(admin.token))
        .send({ status: 'DRAFT' });
      expect(backToDraft.status).toBe(400);
      expect(backToDraft.body.error.message).toMatch(/cannot transition event status/i);

      // 5. Transition OPEN -> COMPLETED (200)
      const completeRes = await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(admin.token))
        .send({ status: 'COMPLETED' });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');

      // 6. Terminal status cannot change to anything else (400)
      const fromCompleted = await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(admin.token))
        .send({ status: 'OPEN' });
      expect(fromCompleted.status).toBe(400);
      expect(fromCompleted.body.error.message).toMatch(/cannot transition event status/i);
    });

    it('allows cancelling an OPEN or DRAFT event (200)', async () => {
      const createRes = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Hackathon',
          description: '48 hour hackathon.',
          eventType: 'WORKSHOP',
          mode: 'OFFLINE',
          venueOrLink: 'Lab 3',
          startAt: '2026-12-10T10:00:00Z',
          endAt: '2026-12-12T10:00:00Z',
          capacity: 50,
          status: 'OPEN',
        });
      const eventId = createRes.body.data.eventId;

      const cancelRes = await api()
        .patch(`/api/events/${eventId}/cancel`)
        .set(auth(admin.token));

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    it('lists OPEN events publicly and hides DRAFT events from non-admins', async () => {
      // 1 DRAFT event
      await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Secret Draft Workshop',
          description: 'Not yet announced.',
          eventType: 'WORKSHOP',
          mode: 'ONLINE',
          venueOrLink: 'https://secret.link',
          startAt: '2026-12-18T10:00:00Z',
          endAt: '2026-12-18T12:00:00Z',
          capacity: 20,
          status: 'DRAFT',
        });

      // 1 OPEN event
      await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Public Tech Webinar',
          description: 'Open for all alumni and students.',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://open.link',
          startAt: '2026-12-19T10:00:00Z',
          endAt: '2026-12-19T12:00:00Z',
          capacity: 100,
          status: 'OPEN',
        });

      // Public / alumni query
      const publicList = await api().get('/api/events').set(auth(alumni1.token));
      expect(publicList.status).toBe(200);
      expect(publicList.body.data).toHaveLength(1);
      expect(publicList.body.data[0].title).toBe('Public Tech Webinar');

      // Admin query sees both
      const adminList = await api().get('/api/events').set(auth(admin.token));
      expect(adminList.status).toBe(200);
      expect(adminList.body.data).toHaveLength(2);
    });

    it('allows an admin to delete an event (200)', async () => {
      const createRes = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Temporary Meetup',
          description: 'To be deleted.',
          eventType: 'REUNION',
          mode: 'OFFLINE',
          venueOrLink: 'Cafe',
          startAt: '2026-12-08T10:00:00Z',
          endAt: '2026-12-08T12:00:00Z',
          capacity: 10,
        });
      const eventId = createRes.body.data.eventId;

      const deleteRes = await api()
        .delete(`/api/events/${eventId}`)
        .set(auth(admin.token));

      expect(deleteRes.status).toBe(200);

      const getRes = await api().get(`/api/events/${eventId}`).set(auth(admin.token));
      expect(getRes.status).toBe(404);
    });
  });

  describe('Event Registration & Waitlist Flow (B6)', () => {
    let smallEvent, expiredEvent;

    beforeEach(async () => {
      // Event with capacity = 2
      const res = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'AI Hands-on Workshop',
          description: 'Limited seating practical AI workshop.',
          eventType: 'WORKSHOP',
          mode: 'OFFLINE',
          venueOrLink: 'AI Computing Lab',
          startAt: '2026-12-25T10:00:00Z',
          endAt: '2026-12-25T14:00:00Z',
          capacity: 2, // Only 2 confirmed spots
          registrationDeadline: '2026-12-24T23:59:59Z',
          status: 'OPEN',
        });
      smallEvent = res.body.data;

      // Event with past registration deadline
      const resExpired = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Expired Registration Seminar',
          description: 'Registration already closed.',
          eventType: 'WEBINAR',
          mode: 'ONLINE',
          venueOrLink: 'https://meet.google.com/exp-ired-sem',
          startAt: '2026-12-30T10:00:00Z',
          endAt: '2026-12-30T12:00:00Z',
          capacity: 50,
          registrationDeadline: '2026-11-01T00:00:00Z', // In the past
          status: 'OPEN',
        });
      expiredEvent = resExpired.body.data;
    });

    it('registers user with REGISTERED status until capacity is reached (201)', async () => {
      // 1st attendee
      const res1 = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(alumni1.token));

      expect(res1.status).toBe(201);
      expect(res1.body.data.regStatus).toBe('REGISTERED');

      // 2nd attendee
      const res2 = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(alumni2.token));

      expect(res2.status).toBe(201);
      expect(res2.body.data.regStatus).toBe('REGISTERED');

      // Verify notification for confirmed user
      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [alumni1.id, 'EVENT_REGISTRATION']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toMatch(/confirmed/i);
    });

    it('places next registrants on WAITLISTED when capacity is reached (201)', async () => {
      // Fill the 2 confirmed spots
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni1.token));
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni2.token));

      // 3rd person tries to register -> WAITLISTED
      const res3 = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(student1.token));

      expect(res3.status).toBe(201);
      expect(res3.body.data.regStatus).toBe('WAITLISTED');

      // 4th person tries to register -> WAITLISTED
      const res4 = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(student2.token));

      expect(res4.status).toBe(201);
      expect(res4.body.data.regStatus).toBe('WAITLISTED');

      // Check notification for waitlisted user
      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [student1.id, 'EVENT_REGISTRATION']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toMatch(/waitlisted/i);
    });

    it('rejects repeat registrations from the same user with 409 conflict', async () => {
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni1.token));

      const repeat = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(alumni1.token));

      expect(repeat.status).toBe(409);
      expect(repeat.body.error.message).toMatch(/already registered/i);
    });

    it('rejects registration when deadline has passed with 400', async () => {
      const res = await api()
        .post(`/api/events/${expiredEvent.eventId}/register`)
        .set(auth(alumni1.token));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/deadline has passed/i);
    });

    it('rejects registration for events that are not OPEN (400)', async () => {
      const draftRes = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Draft Event',
          description: 'Not yet open.',
          eventType: 'WORKSHOP',
          mode: 'ONLINE',
          venueOrLink: 'https://example.com',
          startAt: '2026-12-20T10:00:00Z',
          endAt: '2026-12-20T12:00:00Z',
          capacity: 10,
          status: 'DRAFT',
        });

      const res = await api()
        .post(`/api/events/${draftRes.body.data.eventId}/register`)
        .set(auth(alumni1.token));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/not open/i);
    });

    it('returns 404 when registering for non-existent event', async () => {
      const res = await api()
        .post('/api/events/999999/register')
        .set(auth(alumni1.token));

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });
  });

  describe('Cancellation and Waitlist Promotion Flow (B6)', () => {
    let smallEvent;

    beforeEach(async () => {
      const res = await api()
        .post('/api/events')
        .set(auth(admin.token))
        .send({
          title: 'Exclusive Robotics Lab Tour',
          description: 'Tour of cutting edge robotics lab.',
          eventType: 'WORKSHOP',
          mode: 'OFFLINE',
          venueOrLink: 'Robotics Wing',
          startAt: '2026-12-28T14:00:00Z',
          endAt: '2026-12-28T16:00:00Z',
          capacity: 2,
          registrationDeadline: '2026-12-27T23:59:59Z',
          status: 'OPEN',
        });
      smallEvent = res.body.data;

      // 2 confirmed: alumni1, alumni2
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni1.token));
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni2.token));

      // 2 waitlisted: student1 (first in line), student2 (second in line)
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(student1.token));
      await api().post(`/api/events/${smallEvent.eventId}/register`).set(auth(student2.token));
    });

    it('automatically promotes the next waitlisted user when a confirmed registrant cancels (200)', async () => {
      // alumni1 cancels their confirmed spot
      const cancelRes = await api()
        .delete(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(alumni1.token));

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.promotedUserId).toBe(student1.id);

      // Verify alumni1 status is now CANCELLED
      const { rows: rowsAlumni1 } = await pool.query(
        'SELECT reg_status FROM event_registration WHERE event_id = $1 AND user_id = $2',
        [smallEvent.eventId, alumni1.id]
      );
      expect(rowsAlumni1[0].reg_status).toBe('CANCELLED');

      // Verify student1 was PROMOTED to REGISTERED
      const { rows: rowsStudent1 } = await pool.query(
        'SELECT reg_status FROM event_registration WHERE event_id = $1 AND user_id = $2',
        [smallEvent.eventId, student1.id]
      );
      expect(rowsStudent1[0].reg_status).toBe('REGISTERED');

      // Verify student2 remains WAITLISTED
      const { rows: rowsStudent2 } = await pool.query(
        'SELECT reg_status FROM event_registration WHERE event_id = $1 AND user_id = $2',
        [smallEvent.eventId, student2.id]
      );
      expect(rowsStudent2[0].reg_status).toBe('WAITLISTED');

      // Verify student1 received promotion notification
      const { rows: notifRows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2 AND title ILIKE $3',
        [student1.id, 'EVENT_REGISTRATION', '%promoted%']
      );
      expect(notifRows).toHaveLength(1);
      expect(notifRows[0].body).toContain(smallEvent.title);
    });

    it('allows a waitlisted user to cancel their registration without promoting anyone (200)', async () => {
      // student1 (who is waitlisted) cancels
      const cancelRes = await api()
        .delete(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(student1.token));

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.promotedUserId).toBeNull();

      // Both alumni1 and alumni2 remain REGISTERED
      const { rows: confirmedRows } = await pool.query(
        "SELECT user_id FROM event_registration WHERE event_id = $1 AND reg_status = 'REGISTERED'",
        [smallEvent.eventId]
      );
      expect(confirmedRows).toHaveLength(2);

      // student2 remains WAITLISTED
      const { rows: waitlistRows } = await pool.query(
        "SELECT user_id FROM event_registration WHERE event_id = $1 AND reg_status = 'WAITLISTED'",
        [smallEvent.eventId]
      );
      expect(waitlistRows).toHaveLength(1);
      expect(waitlistRows[0].user_id).toBe(student2.id);
    });

    it('allows cancelled user to re-register later if space permits', async () => {
      // alumni1 cancels
      await api().delete(`/api/events/${smallEvent.eventId}/register`).set(auth(alumni1.token));

      // alumni1 re-registers (will be placed on waitlist because capacity is full)
      const reReg = await api()
        .post(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(alumni1.token));

      expect(reReg.status).toBe(201);
      expect(reReg.body.data.regStatus).toBe('WAITLISTED');
    });

    it('returns 404 when cancelling registration that does not exist', async () => {
      const otherUser = await createUser({ role: 'ADMIN', fullName: 'Stranger Admin' });
      const res = await api()
        .delete(`/api/events/${smallEvent.eventId}/register`)
        .set(auth(otherUser.token));

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/active registration not found/i);
    });

    it('allows admin to view attendee and waitlist lists (200)', async () => {
      const res = await api()
        .get(`/api/events/${smallEvent.eventId}/registrations`)
        .set(auth(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4); // 2 confirmed, 2 waitlisted
      expect(res.body.pagination.total).toBe(4);

      // Non-admin cannot view
      const forbiddenRes = await api()
        .get(`/api/events/${smallEvent.eventId}/registrations`)
        .set(auth(alumni1.token));
      expect(forbiddenRes.status).toBe(403);
    });

    it('allows user to view their own event registrations (200)', async () => {
      const res = await api()
        .get('/api/events/registrations/me')
        .set(auth(alumni1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].eventId).toBe(smallEvent.eventId);
    });
  });
});
