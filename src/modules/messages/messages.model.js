const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

// Creates a new message in an existing connection.
async function create({ connectionId, senderId, content }, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO message (connection_id, sender_id, content)
     VALUES ($1, $2, $3)
     RETURNING message_id AS "messageId", connection_id AS "connectionId",
               sender_id AS "senderId", content,
               sent_at AS "sentAt", read_at AS "readAt"`,
    [connectionId, senderId, content]
  );
  return rows[0];
}

// Lists messages for a connection chronologically, paginated.
async function listByConnection(connectionId, { page = 1, limit = 50 } = {}, db = { query }) {
  const { rows: countRows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM message WHERE connection_id = $1',
    [connectionId]
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });

  const { rows } = await db.query(
    `SELECT m.message_id AS "messageId",
            m.connection_id AS "connectionId",
            m.sender_id AS "senderId",
            m.content,
            m.sent_at AS "sentAt",
            m.read_at AS "readAt",
            u.full_name AS "senderName"
       FROM message m
       JOIN users u ON u.user_id = m.sender_id
      WHERE m.connection_id = $1
      ORDER BY m.sent_at ASC, m.message_id ASC
      LIMIT $2 OFFSET $3`,
    [connectionId, lim, offset]
  );

  return { rows, total };
}

// Finds a single message by ID.
async function findById(messageId, db = { query }) {
  const { rows } = await db.query(
    `SELECT m.message_id AS "messageId",
            m.connection_id AS "connectionId",
            m.sender_id AS "senderId",
            m.content,
            m.sent_at AS "sentAt",
            m.read_at AS "readAt",
            u.full_name AS "senderName"
       FROM message m
       JOIN users u ON u.user_id = m.sender_id
      WHERE m.message_id = $1`,
    [messageId]
  );
  return rows[0];
}

// Marks unread messages in a connection as read for a given recipient.
async function markAsRead(connectionId, userId, db = { query }) {
  const { rowCount } = await db.query(
    `UPDATE message
        SET read_at = NOW()
      WHERE connection_id = $1
        AND sender_id <> $2
        AND read_at IS NULL`,
    [connectionId, userId]
  );
  return rowCount;
}

module.exports = {
  create,
  listByConnection,
  findById,
  markAsRead,
};
