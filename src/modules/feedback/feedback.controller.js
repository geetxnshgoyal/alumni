const feedback = require('./feedback.model');
const { notify } = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');
const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');

async function submitFeedback(req, res, next) {
  try {
    const userId = req.user.id || req.user.userId;
    const { category = 'GENERAL', message } = req.valid?.body || req.body;

    const item = await feedback.createFeedback({
      userId,
      category,
      message
    });

    await audit.log({
      actorId: userId,
      action: 'FEEDBACK_SUBMIT',
      entityName: 'feedback',
      entityId: item.feedbackId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
}

async function getMyFeedback(req, res, next) {
  try {
    const userId = req.user.id || req.user.userId;
    const { status, category, page = 1, limit = 20 } = req.valid?.query || req.query;

    const { rows, total } = await feedback.listFeedback({
      userId,
      status,
      category,
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

async function listFeedback(req, res, next) {
  try {
    const { status, category, page = 1, limit = 20 } = req.valid?.query || req.query;

    const { rows, total } = await feedback.listFeedback({
      status,
      category,
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

async function getFeedbackById(req, res, next) {
  try {
    const feedbackId = Number(req.params.id);
    if (!feedbackId || Number.isNaN(feedbackId)) {
      throw new ApiError(400, 'Invalid feedback ID');
    }

    const item = await feedback.findFeedbackById(feedbackId);
    if (!item) {
      throw new ApiError(404, 'Feedback item not found');
    }

    const currentUserId = req.user.id || req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    if (item.userId !== currentUserId && !isAdmin) {
      throw new ApiError(403, 'Permission denied');
    }

    res.json({ data: item });
  } catch (err) {
    next(err);
  }
}

async function updateFeedback(req, res, next) {
  try {
    const feedbackId = Number(req.params.id);
    const { status, adminResponse } = req.valid?.body || req.body;
    const adminId = req.user.id || req.user.userId;

    const existing = await feedback.findFeedbackById(feedbackId);
    if (!existing) {
      throw new ApiError(404, 'Feedback item not found');
    }

    const updated = await feedback.updateFeedback(feedbackId, {
      status,
      adminResponse,
      respondedBy: adminId
    });

    // Notify user if admin response is provided
    if (adminResponse && adminResponse.trim()) {
      await notify(existing.userId, {
        type: 'FEEDBACK_REPLY',
        title: `Admin Response to Your Feedback`,
        body: adminResponse,
        linkUrl: `#/feedback`
      });
    }

    await audit.log({
      actorId: adminId,
      action: 'FEEDBACK_STATUS_UPDATE',
      entityName: 'feedback',
      entityId: feedbackId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitFeedback,
  getMyFeedback,
  listFeedback,
  getFeedbackById,
  updateFeedback
};
