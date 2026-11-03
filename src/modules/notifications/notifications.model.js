const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

const COLUMNS = `notification_id AS "notificationId", notif_type AS "type", title, body,
                 link_url AS "linkUrl", is_read AS "isRead", created_at AS "createdAt"`;

// Creates an in-app notification. Other modules call this, e.g.
// notify(applicantId, { type: 'JOB_APPLICATION', title: 'You were shortlisted', linkUrl: '#/jobs/4' })
// Pass `db` (a transaction client) to make it part of a transaction.
async function notify(userId, { type, title, body = null, linkUrl = null }, db = { query }) {
  await db.query(
    'INSERT INTO notification (user_id, notif_type, title, body, link_url) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, title, body, linkUrl]
  );
}

async function notifyRole(role, payload, db = { query }) {
  await db.query(
    `INSERT INTO notification (user_id, notif_type, title, body, link_url)
     SELECT user_id, $2, $3, $4, $5 FROM users WHERE role = $1 AND account_status = 'ACTIVE'`,
    [role, payload.type, payload.title, payload.body ?? null, payload.linkUrl ?? null]
  );
}

async function listForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const filter = unreadOnly ? 'AND is_read = FALSE' : '';
  const { rows: counts } = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread
       FROM notification WHERE user_id = $1`,
    [userId]
  );
  const { limit: lim, offset } = toLimitOffset({ page, limit });
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM notification
      WHERE user_id = $1 ${filter}
      ORDER BY created_at DESC, notification_id DESC
      LIMIT $2 OFFSET $3`,
    [userId, lim, offset]
  );
  const total = unreadOnly ? (counts[0]?.unread || 0) : (counts[0]?.total || 0);
  return { rows, total, unread: counts[0]?.unread || 0 };
}

// Returns the updated notification, or undefined if it does not belong to this user.
async function markRead(userId, notificationId) {
  const { rows } = await query(
    `UPDATE notification SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [notificationId, userId]
  );
  return rows[0];
}

async function markAllRead(userId) {
  const { rowCount } = await query(
    'UPDATE notification SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return rowCount;
}

module.exports = { notify, notifyRole, listForUser, markRead, markAllRead };
