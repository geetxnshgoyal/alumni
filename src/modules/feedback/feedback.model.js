const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

const FEEDBACK_COLUMNS = `
  f.feedback_id AS "feedbackId",
  f.user_id AS "userId",
  f.category,
  f.message,
  f.status,
  f.admin_response AS "adminResponse",
  f.responded_by AS "respondedBy",
  f.responded_at AS "respondedAt",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  u.full_name AS "userName",
  u.email AS "userEmail",
  u.role AS "userRole",
  resp.full_name AS "responderName"
`;

async function createFeedback({ userId, category = 'GENERAL', message }, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO feedback (user_id, category, message, status)
     VALUES ($1, $2, $3, 'OPEN')
     RETURNING feedback_id AS "feedbackId", user_id AS "userId", category, message,
               status, created_at AS "createdAt"`,
    [userId, category, message]
  );
  return rows[0];
}

async function findFeedbackById(feedbackId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${FEEDBACK_COLUMNS}
     FROM feedback f
     JOIN users u ON u.user_id = f.user_id
     LEFT JOIN users resp ON resp.user_id = f.responded_by
     WHERE f.feedback_id = $1`,
    [feedbackId]
  );
  return rows[0] || null;
}

async function listFeedback({ userId, status, category, page = 1, limit = 20 } = {}, db = { query }) {
  const conditions = [];
  const values = [];

  if (userId) {
    values.push(userId);
    conditions.push(`f.user_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`f.status = $${values.length}`);
  }

  if (category) {
    values.push(category);
    conditions.push(`f.category = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM feedback f ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await db.query(
    `SELECT ${FEEDBACK_COLUMNS}
     FROM feedback f
     JOIN users u ON u.user_id = f.user_id
     LEFT JOIN users resp ON resp.user_id = f.responded_by
     ${whereClause}
     ORDER BY f.created_at DESC, f.feedback_id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

async function updateFeedback(feedbackId, { status, adminResponse = null, respondedBy = null }, db = { query }) {
  const fields = ['status = $2', 'updated_at = NOW()'];
  const values = [feedbackId, status];

  if (adminResponse !== undefined) {
    values.push(adminResponse);
    fields.push(`admin_response = $${values.length}`);
  }

  if (respondedBy !== undefined) {
    values.push(respondedBy);
    fields.push(`responded_by = $${values.length}`);
    fields.push(`responded_at = NOW()`);
  }

  const { rows } = await db.query(
    `UPDATE feedback
     SET ${fields.join(', ')}
     WHERE feedback_id = $1
     RETURNING feedback_id AS "feedbackId", user_id AS "userId", status,
               admin_response AS "adminResponse", responded_at AS "respondedAt", updated_at AS "updatedAt"`,
    values
  );
  return rows[0] || null;
}

async function deleteFeedback(feedbackId, db = { query }) {
  const { rowCount } = await db.query('DELETE FROM feedback WHERE feedback_id = $1', [feedbackId]);
  return rowCount > 0;
}

module.exports = {
  createFeedback,
  findFeedbackById,
  listFeedback,
  updateFeedback,
  deleteFeedback
};
