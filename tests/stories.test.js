const { setupDb, resetDb, closeDb, createUser, createDepartment, api } = require('./helpers');
const { pool } = require('../src/db/pool');

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

describe('Success Stories Module (#C4)', () => {
  let deptId;
  let admin;
  let alumni1;
  let alumni2;
  let student;

  beforeEach(async () => {
    deptId = await createDepartment('CE', 'Computer Engineering');
    admin = await createUser({ role: 'ADMIN' });
    alumni1 = await createUser({ role: 'ALUMNI', deptId, fullName: 'Aarav Patel' });
    alumni2 = await createUser({ role: 'ALUMNI', deptId, fullName: 'Diya Shah' });
    student = await createUser({ role: 'STUDENT', deptId, fullName: 'Harsh Student' });
  });

  describe('POST /api/stories (Submission)', () => {
    it('allows verified alumni to submit a story with SUBMITTED status', async () => {
      const res = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({
          title: 'Journey from Lab 4 to Lead Architect at Google',
          body: 'Working on deep distributed systems was inspired right in the college campus laboratory with fellow peers.',
          category: 'CAREER'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Journey from Lab 4 to Lead Architect at Google',
        status: 'SUBMITTED',
        category: 'CAREER',
        authorId: alumni1.id
      });
      expect(res.body.data.storyId).toBeDefined();
    });

    it('rejects submissions from students with 403', async () => {
      const res = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          title: 'My Internship Experience',
          body: 'Great learning experience during summer break working on web components.',
          category: 'CAREER'
        });

      expect(res.status).toBe(403);
    });

    it('rejects a non-numeric story id with 400 and a field error', async () => {
      const res = await api().get('/api/stories/abc');
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ location: 'params', field: 'id' })]));
    });

    it('rejects invalid inputs with 400', async () => {
      const res = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({
          title: 'Tiny', // under 5 characters
          body: 'Too short' // under 20 characters
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/stories (Discovery and Moderation Visibility)', () => {
    let approvedStory;
    let submittedStory;

    beforeEach(async () => {
      const res1 = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({
          title: 'Scaling Cloud Databases across Global Clusters',
          body: 'Building reliable fault-tolerant storage architectures and what we learned from outages.',
          category: 'INNOVATION'
        });
      submittedStory = res1.body.data;

      // Admin approves res1 to create an approved story
      const appRes = await api()
        .patch(`/api/stories/${submittedStory.storyId}/review`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'APPROVED', reviewNote: 'Excellent technical story.' });
      approvedStory = appRes.body.data;

      // Alumni 2 submits a second story that stays SUBMITTED
      const res2 = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni2.token}`)
        .send({
          title: 'Bootstrapping an AI Healthcare Startup',
          body: 'From raising early seed funds to clinical trials with hospitals and clinicians.',
          category: 'STARTUP'
        });
      submittedStory = res2.body.data;
    });

    it('public feed returns only APPROVED stories', async () => {
      const res = await api().get('/api/stories');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].storyId).toBe(approvedStory.storyId);
      expect(res.body.data[0].status).toBe('APPROVED');
    });

    it('admin can filter and view SUBMITTED stories in review queue', async () => {
      const res = await api()
        .get('/api/stories?status=SUBMITTED')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some(s => s.storyId === submittedStory.storyId)).toBe(true);
    });

    it('author can view their own submitted story', async () => {
      const res = await api()
        .get(`/api/stories/${submittedStory.storyId}`)
        .set('Authorization', `Bearer ${alumni2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.storyId).toBe(submittedStory.storyId);
    });

    it('other alumni cannot view another user unapproved story (403)', async () => {
      const res = await api()
        .get(`/api/stories/${submittedStory.storyId}`)
        .set('Authorization', `Bearer ${alumni1.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/stories/:id/review (Admin Review & Author Notification)', () => {
    let story;

    beforeEach(async () => {
      const res = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({
          title: 'Leading Engineering Teams at Microsoft',
          body: 'How campus student mentorship prepared me for technical leadership roles worldwide.',
          category: 'LEADERSHIP'
        });
      story = res.body.data;
    });

    it('admin approves story: status becomes APPROVED and author receives notification', async () => {
      const res = await api()
        .patch(`/api/stories/${story.storyId}/review`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          status: 'APPROVED',
          reviewNote: 'Great contribution to the alumni magazine.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');

      // Verify author received in-app notification
      const notifRes = await api()
        .get('/api/notifications')
        .set('Authorization', `Bearer ${alumni1.token}`);

      expect(notifRes.status).toBe(200);
      expect(notifRes.body.data.some(n => n.type === 'STORY_REVIEW')).toBe(true);
    });

    it('admin rejects story with note: author notified of rejection reason', async () => {
      const res = await api()
        .patch(`/api/stories/${story.storyId}/review`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          status: 'REJECTED',
          reviewNote: 'Please add more details regarding your graduation year and college memories.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.reviewNote).toContain('Please add more details');

      const notifRes = await api()
        .get('/api/notifications')
        .set('Authorization', `Bearer ${alumni1.token}`);

      expect(notifRes.body.data.some(n => n.type === 'STORY_REVIEW' && n.body.includes('was not approved'))).toBe(true);
    });

    it('rejects non-admin review attempt with 403', async () => {
      const res = await api()
        .patch(`/api/stories/${story.storyId}/review`)
        .set('Authorization', `Bearer ${alumni2.token}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid review status with 400', async () => {
      const res = await api()
        .patch(`/api/stories/${story.storyId}/review`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PENDING' }); // not in APPROVED | REJECTED

      expect(res.status).toBe(400);
    });
  });

  describe('Author Management (Update / Delete)', () => {
    it('author can edit submitted story and delete it', async () => {
      const res = await api()
        .post('/api/stories')
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({
          title: 'Draft Journey Title',
          body: 'This is the initial draft content describing career path highlights.',
          category: 'CAREER'
        });
      const storyId = res.body.data.storyId;

      // Author update
      const updateRes = await api()
        .patch(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${alumni1.token}`)
        .send({ title: 'Refined Journey Title with Better Focus' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Refined Journey Title with Better Focus');

      // Author delete
      const delRes = await api()
        .delete(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${alumni1.token}`);

      expect(delRes.status).toBe(204);

      // Verify deletion
      const checkRes = await api()
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
