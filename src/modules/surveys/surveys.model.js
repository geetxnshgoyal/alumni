const { query, withTransaction } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');

async function createSurveyWithQuestions({ createdBy, title, description = null, opensAt = null, closesAt = null, status = 'ACTIVE', questions = [] }, db = { query }) {
  return withTransaction(async (tx) => {
    const surveyRes = await tx.query(
      `INSERT INTO survey (created_by, title, description, opens_at, closes_at, status)
       VALUES ($1, $2, $3, COALESCE($4, NOW()), $5, $6)
       RETURNING survey_id AS "surveyId", created_by AS "createdBy", title, description,
                 opens_at AS "opensAt", closes_at AS "closesAt", status, created_at AS "createdAt"`,
      [createdBy, title, description, opensAt, closesAt, status]
    );
    const survey = surveyRes.rows[0];
    survey.questions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qRes = await tx.query(
        `INSERT INTO survey_question (survey_id, question_text, question_type, is_required, position)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING question_id AS "questionId", survey_id AS "surveyId", question_text AS "questionText",
                   question_type AS "questionType", is_required AS "isRequired", position`,
        [survey.surveyId, q.questionText, q.questionType, q.isRequired ?? true, q.position ?? (i + 1)]
      );
      const insertedQuestion = qRes.rows[0];
      insertedQuestion.options = [];

      if (['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(q.questionType) && Array.isArray(q.options)) {
        for (let j = 0; j < q.options.length; j++) {
          const optText = q.options[j];
          const optRes = await tx.query(
            `INSERT INTO question_option (question_id, option_text, position)
             VALUES ($1, $2, $3)
             RETURNING option_id AS "optionId", question_id AS "questionId", option_text AS "optionText", position`,
            [insertedQuestion.questionId, optText, j + 1]
          );
          insertedQuestion.options.push(optRes.rows[0]);
        }
      }

      survey.questions.push(insertedQuestion);
    }

    return survey;
  });
}

async function findSurveyById(surveyId, { userId = null } = {}, db = { query }) {
  const surveyRes = await db.query(
    `SELECT s.survey_id AS "surveyId", s.created_by AS "createdBy", s.title, s.description,
            s.opens_at AS "opensAt", s.closes_at AS "closesAt", s.status, s.created_at AS "createdAt",
            s.updated_at AS "updatedAt", u.full_name AS "creatorName"
     FROM survey s
     JOIN users u ON u.user_id = s.created_by
     WHERE s.survey_id = $1`,
    [surveyId]
  );
  if (!surveyRes.rows.length) return null;
  const survey = surveyRes.rows[0];

  const qRes = await db.query(
    `SELECT question_id AS "questionId", survey_id AS "surveyId", question_text AS "questionText",
            question_type AS "questionType", is_required AS "isRequired", position
     FROM survey_question
     WHERE survey_id = $1
     ORDER BY position ASC, question_id ASC`,
    [surveyId]
  );
  survey.questions = qRes.rows;

  if (survey.questions.length) {
    const questionIds = survey.questions.map((q) => q.questionId);
    const optRes = await db.query(
      `SELECT option_id AS "optionId", question_id AS "questionId", option_text AS "optionText", position
       FROM question_option
       WHERE question_id = ANY($1::int[])
       ORDER BY position ASC, option_id ASC`,
      [questionIds]
    );

    const optionsByQ = {};
    for (const opt of optRes.rows) {
      if (!optionsByQ[opt.questionId]) optionsByQ[opt.questionId] = [];
      optionsByQ[opt.questionId].push(opt);
    }

    for (const q of survey.questions) {
      q.options = optionsByQ[q.questionId] || [];
    }
  }

  // Check if current user has already responded
  survey.hasResponded = false;
  if (userId) {
    const respCheck = await db.query(
      'SELECT response_id AS "responseId" FROM survey_response WHERE survey_id = $1 AND user_id = $2',
      [surveyId, userId]
    );
    survey.hasResponded = respCheck.rows.length > 0;
  }

  return survey;
}

async function listSurveys({ status, userId = null, page = 1, limit = 10 } = {}, db = { query }) {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`s.status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM survey s ${whereClause}`, values);
  const total = countRes.rows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await db.query(
    `SELECT s.survey_id AS "surveyId", s.title, s.description, s.opens_at AS "opensAt",
            s.closes_at AS "closesAt", s.status, s.created_at AS "createdAt",
            COUNT(DISTINCT sq.question_id)::int AS "questionCount",
            COUNT(DISTINCT sr.response_id)::int AS "responseCount",
            ${userId ? `COALESCE(BOOL_OR(sr.user_id = ${Number(userId)}), FALSE) AS "hasResponded"` : 'FALSE AS "hasResponded"'}
     FROM survey s
     LEFT JOIN survey_question sq ON sq.survey_id = s.survey_id
     LEFT JOIN survey_response sr ON sr.survey_id = s.survey_id
     ${whereClause}
     GROUP BY s.survey_id
     ORDER BY s.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

async function updateSurveyStatus(surveyId, status, db = { query }) {
  const { rows } = await db.query(
    `UPDATE survey SET status = $2, updated_at = NOW() WHERE survey_id = $1 RETURNING survey_id AS "surveyId", title, status`,
    [surveyId, status]
  );
  return rows[0] || null;
}

async function submitResponse({ surveyId, userId, answers }, db = { query }) {
  return withTransaction(async (tx) => {
    // 1. Check if survey exists and is ACTIVE
    const sRes = await tx.query('SELECT survey_id, status FROM survey WHERE survey_id = $1', [surveyId]);
    if (!sRes.rows.length) {
      throw new ApiError(404, 'Survey not found');
    }
    if (sRes.rows[0].status !== 'ACTIVE') {
      throw new ApiError(400, 'Survey is not active for submissions');
    }

    // 2. Acceptance test: One response per user
    const existing = await tx.query(
      'SELECT response_id FROM survey_response WHERE survey_id = $1 AND user_id = $2',
      [surveyId, userId]
    );
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'You have already submitted a response for this survey');
    }

    // 3. Acceptance test: Required questions enforced & answer types validated
    const { rows: questions } = await tx.query(
      `SELECT question_id AS "questionId", question_text AS "questionText",
              question_type AS "questionType", is_required AS "isRequired"
       FROM survey_question
       WHERE survey_id = $1`,
      [surveyId]
    );

    const answersByQ = new Map(answers.map((a) => [a.questionId, a]));

    for (const q of questions) {
      const a = answersByQ.get(q.questionId);
      if (q.isRequired) {
        if (!a) {
          throw new ApiError(400, `Question "${q.questionText}" is required`);
        }
        if (q.questionType === 'TEXT' && (!a.answerText || !a.answerText.trim())) {
          throw new ApiError(400, `Text answer required for question "${q.questionText}"`);
        }
        if (q.questionType === 'RATING' && (a.ratingValue === undefined || a.ratingValue === null)) {
          throw new ApiError(400, `Rating required for question "${q.questionText}"`);
        }
        if (['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(q.questionType) && (!a.optionIds || !a.optionIds.length)) {
          throw new ApiError(400, `Selection required for question "${q.questionText}"`);
        }
      }

      if (a) {
        if (q.questionType === 'RATING' && a.ratingValue !== null && a.ratingValue !== undefined) {
          if (a.ratingValue < 1 || a.ratingValue > 5) {
            throw new ApiError(400, `Rating must be an integer between 1 and 5 for question "${q.questionText}"`);
          }
        }
      }
    }

    // 4. Create response header
    const respRes = await tx.query(
      `INSERT INTO survey_response (survey_id, user_id)
       VALUES ($1, $2)
       RETURNING response_id AS "responseId", survey_id AS "surveyId", user_id AS "userId", submitted_at AS "submittedAt"`,
      [surveyId, userId]
    );
    const response = respRes.rows[0];

    // 5. Store each answer
    for (const a of answers) {
      const q = questions.find((item) => item.questionId === a.questionId);
      if (!q) continue; // ignore unknown questions

      const ansRes = await tx.query(
        `INSERT INTO response_answer (response_id, question_id, answer_text, rating_value)
         VALUES ($1, $2, $3, $4)
         RETURNING answer_id AS "answerId"`,
        [response.responseId, a.questionId, a.answerText || null, a.ratingValue || null]
      );
      const answerId = ansRes.rows[0].answerId;

      if (Array.isArray(a.optionIds) && a.optionIds.length > 0) {
        for (const optId of a.optionIds) {
          await tx.query(
            `INSERT INTO answer_choice (answer_id, option_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [answerId, optId]
          );
        }
      }
    }

    return response;
  });
}

async function getUserResponse(surveyId, userId, db = { query }) {
  const respRes = await db.query(
    `SELECT response_id AS "responseId", survey_id AS "surveyId", submitted_at AS "submittedAt"
     FROM survey_response
     WHERE survey_id = $1 AND user_id = $2`,
    [surveyId, userId]
  );
  if (!respRes.rows.length) return null;
  const response = respRes.rows[0];

  const answersRes = await db.query(
    `SELECT ra.answer_id AS "answerId", ra.question_id AS "questionId", sq.question_text AS "questionText",
            sq.question_type AS "questionType", ra.answer_text AS "answerText", ra.rating_value AS "ratingValue",
            ARRAY_AGG(ac.option_id) FILTER (WHERE ac.option_id IS NOT NULL) AS "optionIds",
            ARRAY_AGG(qo.option_text) FILTER (WHERE qo.option_text IS NOT NULL) AS "optionTexts"
     FROM response_answer ra
     JOIN survey_question sq ON sq.question_id = ra.question_id
     LEFT JOIN answer_choice ac ON ac.answer_id = ra.answer_id
     LEFT JOIN question_option qo ON qo.option_id = ac.option_id
     WHERE ra.response_id = $1
     GROUP BY ra.answer_id, sq.question_id, sq.question_text, sq.question_type, ra.answer_text, ra.rating_value`,
    [response.responseId]
  );

  response.answers = answersRes.rows;
  return response;
}

module.exports = {
  createSurveyWithQuestions,
  findSurveyById,
  listSurveys,
  updateSurveyStatus,
  submitResponse,
  getUserResponse
};
