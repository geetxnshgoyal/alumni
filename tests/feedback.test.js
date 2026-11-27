const { setupDb, resetDb, closeDb, createUser, createDepartment, api } = require('./helpers');

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

describe('Feedback and Survey Results Analytics (#C6)', () => {
  let deptId;
  let admin;
  let alumni;
  let student;

  beforeEach(async () => {
    deptId = await createDepartment('EC', 'Electronics');
    admin = await createUser({ role: 'ADMIN' });
    alumni = await createUser({ role: 'ALUMNI', deptId, fullName: 'Aarav Patel' });
    student = await createUser({ role: 'STUDENT', deptId, fullName: 'Harsh Student' });
  });

  describe('Feedback Lifecycle (Submit, Statuses & Admin Reply)', () => {
    it('allows authenticated user to submit feedback with OPEN status', async () => {
      const res = await api()
        .post('/api/feedback')
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({
          category: 'PLATFORM',
          message: 'The new dashboard layout and responsive navigation are working smoothly!'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        category: 'PLATFORM',
        status: 'OPEN',
        userId: alumni.id
      });
      expect(res.body.data.feedbackId).toBeDefined();
    });

    it('rejects unauthenticated feedback submission with 401', async () => {
      const res = await api()
        .post('/api/feedback')
        .send({
          category: 'GENERAL',
          message: 'Anonymous feedback attempt'
        });

      expect(res.status).toBe(401);
    });

    it('user can view their submitted feedback', async () => {
      await api()
        .post('/api/feedback')
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({
          category: 'ACADEMIC',
          message: 'Can we introduce VLSI lab workshops on weekends?'
        });

      const res = await api()
        .get('/api/feedback/my')
        .set('Authorization', `Bearer ${alumni.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].message).toContain('VLSI lab workshops');
    });

    it('admin manages feedback status flow (OPEN -> IN_REVIEW -> CLOSED) and replies', async () => {
      const subRes = await api()
        .post('/api/feedback')
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          category: 'EVENT',
          message: 'Can we have an open session with alumni working at semiconductor companies?'
        });

      const feedbackId = subRes.body.data.feedbackId;

      // 1. Admin marks IN_REVIEW
      const reviewRes = await api()
        .patch(`/api/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          status: 'IN_REVIEW',
          adminResponse: 'We are discussing this with the EC alumni chapter.'
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('IN_REVIEW');
      expect(reviewRes.body.data.adminResponse).toContain('EC alumni chapter');

      // Verify student received notification
      const notifRes1 = await api()
        .get('/api/notifications')
        .set('Authorization', `Bearer ${student.token}`);

      expect(notifRes1.body.data.some(n => n.type === 'FEEDBACK_REPLY')).toBe(true);

      // 2. Admin marks CLOSED with resolution
      const closeRes = await api()
        .patch(`/api/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          status: 'CLOSED',
          adminResponse: 'Scheduled! A virtual semiconductor panel is arranged for next month.'
        });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('CLOSED');
    });

    it('rejects skipped or backward status changes with 400', async () => {
      const subRes = await api()
        .post('/api/feedback')
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ category: 'GENERAL', message: 'Please add a dark mode to the portal' });
      const url = `/api/feedback/${subRes.body.data.feedbackId}`;
      const patch = (body) => api().patch(url).set('Authorization', `Bearer ${admin.token}`).send(body);

      expect((await patch({ status: 'CLOSED' })).status).toBe(400); // OPEN -> CLOSED skips review
      expect((await patch({ status: 'IN_REVIEW' })).status).toBe(200);
      expect((await patch({ status: 'IN_REVIEW', adminResponse: 'Still looking' })).status).toBe(200);
      expect((await patch({ status: 'OPEN' })).status).toBe(400); // backward
      expect((await patch({ status: 'CLOSED' })).status).toBe(200);
      expect((await patch({ status: 'IN_REVIEW' })).status).toBe(400); // CLOSED is final
    });

    it('rejects status update from non-admin with 403', async () => {
      const subRes = await api()
        .post('/api/feedback')
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ category: 'GENERAL', message: 'Test message for permission check' });

      const res = await api()
        .patch(`/api/feedback/${subRes.body.data.feedbackId}`)
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ status: 'CLOSED' });

      expect(res.status).toBe(403);
    });
  });

  describe('Survey Results Aggregation (GET /api/surveys/:id/results)', () => {
    let surveyId;

    beforeEach(async () => {
      // Create survey
      const sRes = await api()
        .post('/api/surveys')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          title: 'Curriculum & Lab Feedback',
          status: 'ACTIVE',
          questions: [
            { questionText: 'Lab rating', questionType: 'RATING', isRequired: true, position: 1 },
            {
              questionText: 'Favorite elective',
              questionType: 'SINGLE_CHOICE',
              isRequired: true,
              position: 2,
              options: ['VLSI', 'Embedded Systems']
            },
            { questionText: 'General suggestions', questionType: 'TEXT', isRequired: false, position: 3 }
          ]
        });

      surveyId = sRes.body.data.surveyId;
      const questions = sRes.body.data.questions;
      const ratingQ = questions.find(q => q.questionType === 'RATING');
      const singleQ = questions.find(q => q.questionType === 'SINGLE_CHOICE');
      const textQ = questions.find(q => q.questionType === 'TEXT');

      // Alumni submits response
      await api()
        .post(`/api/surveys/${surveyId}/responses`)
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({
          answers: [
            { questionId: ratingQ.questionId, ratingValue: 5 },
            { questionId: singleQ.questionId, optionIds: [singleQ.options[0].optionId] },
            { questionId: textQ.questionId, answerText: 'More FPGA boards please.' }
          ]
        });

      // Student submits response
      await api()
        .post(`/api/surveys/${surveyId}/responses`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [
            { questionId: ratingQ.questionId, ratingValue: 3 },
            { questionId: singleQ.questionId, optionIds: [singleQ.options[0].optionId] },
            { questionId: textQ.questionId, answerText: 'Great lab sessions overall.' }
          ]
        });
    });

    it('admin receives aggregated results per question with averages and percentages', async () => {
      const res = await api()
        .get(`/api/surveys/${surveyId}/results`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalResponses).toBe(2);

      const qResults = res.body.data.questions;
      expect(qResults).toHaveLength(3);

      // Check RATING aggregation: average = (5 + 3)/2 = 4.0
      const ratingRes = qResults.find(q => q.questionType === 'RATING');
      expect(ratingRes.averageRating).toBe(4);
      expect(ratingRes.distribution[5]).toBe(1);
      expect(ratingRes.distribution[3]).toBe(1);

      // Check SINGLE_CHOICE aggregation: option[0] chosen 2 times (100%)
      const choiceRes = qResults.find(q => q.questionType === 'SINGLE_CHOICE');
      expect(choiceRes.options[0].count).toBe(2);
      expect(choiceRes.options[0].percentage).toBe(100);

      // Check TEXT answers: 2 text entries collected
      const textRes = qResults.find(q => q.questionType === 'TEXT');
      expect(textRes.textAnswers).toHaveLength(2);
      expect(textRes.textAnswers.some(t => t.answerText.includes('FPGA boards'))).toBe(true);
    });

    it('rejects non-admin from viewing aggregated results with 403', async () => {
      const res = await api()
        .get(`/api/surveys/${surveyId}/results`)
        .set('Authorization', `Bearer ${alumni.token}`);

      expect(res.status).toBe(403);
    });
  });
});
