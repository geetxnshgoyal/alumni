const surveys = require('./surveys.model');
const audit = require('../audit/audit.model');
const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');

async function createSurvey(req, res, next) {
  try {
    const createdBy = req.user.id || req.user.userId;
    const { title, description, opensAt, closesAt, status = 'ACTIVE', questions } = req.valid?.body || req.body;

    const survey = await surveys.createSurveyWithQuestions({
      createdBy,
      title,
      description,
      opensAt,
      closesAt,
      status,
      questions
    });

    await audit.log({
      actorId: createdBy,
      action: 'SURVEY_CREATE',
      entityName: 'survey',
      entityId: survey.surveyId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(201).json({ data: survey });
  } catch (err) {
    next(err);
  }
}

async function listSurveys(req, res, next) {
  try {
    const { status, page = 1, limit = 10 } = req.valid?.query || req.query;
    const userId = req.user ? (req.user.id || req.user.userId) : null;
    const isAdmin = req.user?.role === 'ADMIN';

    // Non-admin can only see ACTIVE or CLOSED surveys, not DRAFT
    const filterStatus = !isAdmin && !status ? 'ACTIVE' : status;

    const { rows, total } = await surveys.listSurveys({
      status: filterStatus,
      userId,
      page,
      limit
    });

    res.json({
      data: rows,
      pagination: paginationMeta({ page: Number(page), limit: Number(limit) }, total)
    });
  } catch (err) {
    next(err);
  }
}

async function getSurveyById(req, res, next) {
  try {
    const surveyId = Number(req.params.id);
    if (!surveyId || Number.isNaN(surveyId)) {
      throw new ApiError(400, 'Invalid survey ID');
    }

    const userId = req.user ? (req.user.id || req.user.userId) : null;
    const survey = await surveys.findSurveyById(surveyId, { userId });
    if (!survey) {
      throw new ApiError(404, 'Survey not found');
    }

    res.json({ data: survey });
  } catch (err) {
    next(err);
  }
}

async function updateSurveyStatus(req, res, next) {
  try {
    const surveyId = Number(req.params.id);
    const { status } = req.valid?.body || req.body;

    const updated = await surveys.updateSurveyStatus(surveyId, status);
    if (!updated) {
      throw new ApiError(404, 'Survey not found');
    }

    await audit.log({
      actorId: req.user.id || req.user.userId,
      action: 'SURVEY_STATUS_UPDATE',
      entityName: 'survey',
      entityId: surveyId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

async function submitResponse(req, res, next) {
  try {
    const surveyId = Number(req.params.id);
    if (!surveyId || Number.isNaN(surveyId)) {
      throw new ApiError(400, 'Invalid survey ID');
    }

    const userId = req.user.id || req.user.userId;
    const { answers } = req.valid?.body || req.body;

    const response = await surveys.submitResponse({
      surveyId,
      userId,
      answers
    });

    await audit.log({
      actorId: userId,
      action: 'SURVEY_RESPONSE_SUBMIT',
      entityName: 'survey_response',
      entityId: response.responseId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(201).json({ data: response });
  } catch (err) {
    next(err);
  }
}

async function getMyResponse(req, res, next) {
  try {
    const surveyId = Number(req.params.id);
    const userId = req.user.id || req.user.userId;

    const response = await surveys.getUserResponse(surveyId, userId);
    if (!response) {
      throw new ApiError(404, 'You have not submitted a response for this survey yet');
    }

    res.json({ data: response });
  } catch (err) {
    next(err);
  }
}

async function getSurveyResults(req, res, next) {
  try {
    const surveyId = Number(req.params.id);
    if (!surveyId || Number.isNaN(surveyId)) {
      throw new ApiError(400, 'Invalid survey ID');
    }

    const results = await surveys.getSurveyResults(surveyId);
    if (!results) {
      throw new ApiError(404, 'Survey not found');
    }

    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSurvey,
  listSurveys,
  getSurveyById,
  updateSurveyStatus,
  submitResponse,
  getMyResponse,
  getSurveyResults
};
