const stories = require('./stories.model');
const { notify } = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');
const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');

async function createStory(req, res, next) {
  try {
    const authorId = req.user.id || req.user.userId;
    const { title, body, category = 'CAREER', mediaUrl = null } = req.valid?.body || req.body;

    const story = await stories.createStory({
      authorId,
      title,
      body,
      category,
      mediaUrl,
      status: 'SUBMITTED'
    });

    await audit.log({
      actorId: authorId,
      action: 'STORY_SUBMIT',
      entityName: 'success_story',
      entityId: story.storyId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(201).json({ data: story });
  } catch (err) {
    next(err);
  }
}

async function listStories(req, res, next) {
  try {
    const { page = 1, limit = 12, category, search, status } = req.valid?.query || req.query;
    const isAdmin = req.user?.role === 'ADMIN';

    // Non-admin can only see APPROVED stories in public feed
    const filterStatus = isAdmin && status ? status : 'APPROVED';

    const { rows, total } = await stories.listStories({
      status: filterStatus,
      category,
      search,
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

async function getMyStories(req, res, next) {
  try {
    const authorId = req.user.id || req.user.userId;
    const { page = 1, limit = 20 } = req.valid?.query || req.query;

    const { rows, total } = await stories.listStories({
      authorId,
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

async function getStoryById(req, res, next) {
  try {
    const storyId = Number(req.params.id);
    if (!storyId || Number.isNaN(storyId)) {
      throw new ApiError(400, 'Invalid story ID');
    }

    const story = await stories.findStoryById(storyId);
    if (!story) {
      throw new ApiError(404, 'Success story not found');
    }

    const currentUserId = req.user ? (req.user.id || req.user.userId) : null;
    const isAuthor = currentUserId === story.authorId;
    const isAdmin = req.user && req.user.role === 'ADMIN';

    if (story.status !== 'APPROVED' && !isAuthor && !isAdmin) {
      throw new ApiError(403, 'This story is awaiting moderation and is not publicly visible');
    }

    res.json({ data: story });
  } catch (err) {
    next(err);
  }
}

async function updateStory(req, res, next) {
  try {
    const storyId = Number(req.params.id);
    const story = await stories.findStoryById(storyId);
    if (!story) {
      throw new ApiError(404, 'Success story not found');
    }

    const currentUserId = req.user.id || req.user.userId;
    const isAuthor = currentUserId === story.authorId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to modify this story');
    }

    // Author cannot edit once approved, unless admin
    if (story.status === 'APPROVED' && !isAdmin) {
      throw new ApiError(400, 'Approved stories cannot be directly modified; contact an administrator');
    }

    const updated = await stories.updateStory(storyId, req.valid?.body || req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

async function reviewStory(req, res, next) {
  try {
    const storyId = Number(req.params.id);
    const { status, reviewNote } = req.valid?.body || req.body;
    const reviewerId = req.user.id || req.user.userId;

    const existing = await stories.findStoryById(storyId);
    if (!existing) {
      throw new ApiError(404, 'Success story not found');
    }

    const updated = await stories.reviewStory(storyId, {
      status,
      reviewedBy: reviewerId,
      reviewNote
    });

    // Notify author of review outcome (Acceptance Test: Author notified on review)
    await notify(existing.authorId, {
      type: 'STORY_REVIEW',
      title: status === 'APPROVED' ? 'Your Story Was Published!' : 'Update on Your Story Submission',
      body: status === 'APPROVED'
        ? `Your journey "${existing.title}" is now published on the campus success stories portal!`
        : `Your story "${existing.title}" was not approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      linkUrl: `#/stories`
    });

    await audit.log({
      actorId: reviewerId,
      action: status === 'APPROVED' ? 'STORY_APPROVE' : 'STORY_REJECT',
      entityName: 'success_story',
      entityId: storyId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteStory(req, res, next) {
  try {
    const storyId = Number(req.params.id);
    const story = await stories.findStoryById(storyId);
    if (!story) {
      throw new ApiError(404, 'Success story not found');
    }

    const currentUserId = req.user.id || req.user.userId;
    const isAuthor = currentUserId === story.authorId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      throw new ApiError(403, 'Permission denied');
    }

    await stories.deleteStory(storyId);

    await audit.log({
      actorId: currentUserId,
      action: 'STORY_DELETE',
      entityName: 'success_story',
      entityId: storyId,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createStory,
  listStories,
  getMyStories,
  getStoryById,
  updateStory,
  reviewStory,
  deleteStory
};
