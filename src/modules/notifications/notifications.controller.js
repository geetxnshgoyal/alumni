const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const notifications = require('./notifications.model');

// GET /api/notifications
async function list(req, res) {
  const params = req.valid.query;
  const { rows, total, unread } = await notifications.listForUser(req.user.id, params);
  res.json({ data: rows, unread, pagination: paginationMeta(params, total) });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const { id } = req.valid.params;
  const updated = await notifications.markRead(req.user.id, id);
  if (!updated) throw ApiError.notFound('Notification not found');
  res.json({ data: updated });
}

// POST /api/notifications/read-all
async function markAllRead(req, res) {
  const updatedCount = await notifications.markAllRead(req.user.id);
  res.json({ data: { message: 'All notifications marked as read', updatedCount } });
}

module.exports = { list, markRead, markAllRead };
