const { setupDb, resetDb, closeDb, createUser, createDepartment, api } = require('./helpers');

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

describe('Surveys Module (#C5)', () => {
  let deptId;
  let admin;
  let alumni;
  let student;
  let createdSurvey;

  beforeEach(async () => {
    deptId = await createDepartment('IT', 'Information Technology');
    admin = await createUser({ role: 'ADMIN' });
    alumni = await createUser({ role: 'ALUMNI', deptId, fullName: 'Aarav Patel' });
    student = await createUser({ role: 'STUDENT', deptId, fullName: 'Harsh Vora' });

    // Admin creates a survey with all 4 question types
    const res = await api()
      .post('/api/surveys')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Campus Mentorship & Curriculum Feedback 2026',
        description: 'Gathering inputs from alumni and students regarding curriculum updates.',
        status: 'ACTIVE',
        questions: [
          {
            questionText: 'How would you rate overall industry readiness (1 to 5)?',
            questionType: 'RATING',
            isRequired: true,
            position: 1
          },
          {
            questionText: 'Which primary domain do you specialize in?',
            questionType: 'SINGLE_CHOICE',
            isRequired: true,
            position: 2,
            options: ['Cloud Computing', 'Artificial Intelligence', 'Cybersecurity']
          },
          {
            questionText: 'Which collaborative events would you attend?',
            questionType: 'MULTI_CHOICE',
            isRequired: false,
            position: 3,
            options: ['Hackathons', 'Guest Lectures', 'Mock Interviews']
          },
          {
            questionText: 'Any recommendations for laboratory improvements?',
            questionType: 'TEXT',
            isRequired: true,
            position: 4
          }
        ]
      });

    expect(res.status).toBe(201);
    createdSurvey = res.body.data;
  });

  describe('Survey Creation & Access', () => {
    it('admin creates survey with nested questions and options', async () => {
      expect(createdSurvey.surveyId).toBeDefined();
      expect(createdSurvey.questions).toHaveLength(4);
      const singleChoiceQ = createdSurvey.questions.find((q) => q.questionType === 'SINGLE_CHOICE');
      expect(singleChoiceQ.options).toHaveLength(3);
    });

    it('rejects survey creation by non-admin with 403', async () => {
      const res = await api()
        .post('/api/surveys')
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({
          title: 'Unauthorized Survey',
          questions: [{ questionText: 'Q1', questionType: 'TEXT', isRequired: true }]
        });

      expect(res.status).toBe(403);
    });

    it('lists surveys with question count and responded indicator', async () => {
      const res = await api()
        .get('/api/surveys')
        .set('Authorization', `Bearer ${alumni.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].questionCount).toBe(4);
      expect(res.body.data[0].hasResponded).toBe(false);
    });
  });

  describe('Response Submission (Acceptance Requirements)', () => {
    function buildValidAnswers() {
      const ratingQ = createdSurvey.questions.find((q) => q.questionType === 'RATING');
      const singleQ = createdSurvey.questions.find((q) => q.questionType === 'SINGLE_CHOICE');
      const multiQ = createdSurvey.questions.find((q) => q.questionType === 'MULTI_CHOICE');
      const textQ = createdSurvey.questions.find((q) => q.questionType === 'TEXT');

      return [
        { questionId: ratingQ.questionId, ratingValue: 5 },
        { questionId: singleQ.questionId, optionIds: [singleQ.options[0].optionId] },
        { questionId: multiQ.questionId, optionIds: [multiQ.options[0].optionId, multiQ.options[1].optionId] },
        { questionId: textQ.questionId, answerText: 'Modernize GPUs and setup edge-computing test benches.' }
      ];
    }

    it('submits valid response successfully (201)', async () => {
      const answers = buildValidAnswers();
      const res = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ answers });

      expect(res.status).toBe(201);
      expect(res.body.data.responseId).toBeDefined();

      // Retrieve user response
      const myRes = await api()
        .get(`/api/surveys/${createdSurvey.surveyId}/my-response`)
        .set('Authorization', `Bearer ${alumni.token}`);

      expect(myRes.status).toBe(200);
      expect(myRes.body.data.answers).toHaveLength(4);
    });

    it('enforces one response per user (409 Conflict on duplicate)', async () => {
      const answers = buildValidAnswers();

      // First submission
      const res1 = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ answers });
      expect(res1.status).toBe(201);

      // Repeat submission by same user -> 409
      const res2 = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${alumni.token}`)
        .send({ answers });

      expect(res2.status).toBe(409);
      expect(res2.body.error.message).toContain('already submitted');
    });

    it('enforces required questions (400 if required question answer is missing)', async () => {
      const ratingQ = createdSurvey.questions.find((q) => q.questionType === 'RATING');

      // Only answering rating question, omitting required text and single choice
      const res = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [{ questionId: ratingQ.questionId, ratingValue: 4 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('validates answer types (400 if rating is outside 1 to 5)', async () => {
      const ratingQ = createdSurvey.questions.find((q) => q.questionType === 'RATING');
      const singleQ = createdSurvey.questions.find((q) => q.questionType === 'SINGLE_CHOICE');
      const textQ = createdSurvey.questions.find((q) => q.questionType === 'TEXT');

      const res = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [
            { questionId: ratingQ.questionId, ratingValue: 99 }, // Invalid: > 5
            { questionId: singleQ.questionId, optionIds: [singleQ.options[0].optionId] },
            { questionId: textQ.questionId, answerText: 'Valid text' }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('rejects submissions if survey is CLOSED (400)', async () => {
      // Admin closes survey
      await api()
        .patch(`/api/surveys/${createdSurvey.surveyId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'CLOSED' });

      const answers = buildValidAnswers();
      const res = await api()
        .post(`/api/surveys/${createdSurvey.surveyId}/responses`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({ answers });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not active');
    });
  });
});
