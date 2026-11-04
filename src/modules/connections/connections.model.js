const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

const DETAIL_COLUMNS = `
  c.connection_id AS "connectionId",
  c.requester_id AS "requesterId",
  c.receiver_id AS "receiverId",
  c.connection_type AS "connectionType",
  c.status,
  c.request_note AS "requestNote",
  c.requested_at AS "requestedAt",
  c.responded_at AS "respondedAt",
  u_req.full_name AS "requesterName",
  u_req.email AS "requesterEmail",
  u_req.role AS "requesterRole",
  u_rec.full_name AS "receiverName",
  u_rec.email AS "receiverEmail",
  u_rec.role AS "receiverRole"
`;

// Creates a new connection request.
async function create({ requesterId, receiverId, connectionType = 'NETWORK', requestNote = null }, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO connection (requester_id, receiver_id, connection_type, request_note)
     VALUES ($1, $2, $3, $4)
     RETURNING connection_id AS "connectionId", requester_id AS "requesterId",
               receiver_id AS "receiverId", connection_type AS "connectionType",
               status, request_note AS "requestNote",
               requested_at AS "requestedAt", responded_at AS "respondedAt"`,
    [requesterId, receiverId, connectionType, requestNote]
  );
  return rows[0];
}

// Finds a single connection by ID with requester and receiver details.
async function findById(connectionId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${DETAIL_COLUMNS}
       FROM connection c
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_rec ON u_rec.user_id = c.receiver_id
      WHERE c.connection_id = $1`,
    [connectionId]
  );
  return rows[0];
}

// Finds any existing connection between two users in either direction.
async function findBetweenUsers(userId1, userId2, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${DETAIL_COLUMNS}
       FROM connection c
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_rec ON u_rec.user_id = c.receiver_id
      WHERE (c.requester_id = $1 AND c.receiver_id = $2)
         OR (c.requester_id = $2 AND c.receiver_id = $1)`,
    [userId1, userId2]
  );
  return rows[0];
}

// Updates the status of a connection (e.g. ACCEPTED, REJECTED, BLOCKED) and records responded_at.
async function updateStatus(connectionId, status, db = { query }) {
  const { rows } = await db.query(
    `UPDATE connection
        SET status = $2,
            responded_at = NOW()
      WHERE connection_id = $1
      RETURNING connection_id AS "connectionId", requester_id AS "requesterId",
                receiver_id AS "receiverId", connection_type AS "connectionType",
                status, request_note AS "requestNote",
                requested_at AS "requestedAt", responded_at AS "respondedAt"`,
    [connectionId, status]
  );
  return rows[0];
}

// Lists connections for a user (as requester or receiver), paginated with optional status/type filters.
async function listForUser(userId, { status, type, page = 1, limit = 20 } = {}, db = { query }) {
  const conditions = ['(c.requester_id = $1 OR c.receiver_id = $1)'];
  const values = [userId];

  if (status) {
    values.push(status);
    conditions.push(`c.status = $${values.length}`);
  }
  if (type) {
    values.push(type);
    conditions.push(`c.connection_type = $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM connection c ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  const pagingValues = [...values, lim, offset];

  const { rows } = await db.query(
    `SELECT ${DETAIL_COLUMNS}
       FROM connection c
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_rec ON u_rec.user_id = c.receiver_id
      ${whereClause}
      ORDER BY c.requested_at DESC, c.connection_id DESC
      LIMIT $${pagingValues.length - 1} OFFSET $${pagingValues.length}`,
    pagingValues
  );

  return { rows, total };
}

// Checks whether two users have an accepted connection.
async function getAcceptedConnection(userId1, userId2, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${DETAIL_COLUMNS}
       FROM connection c
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_rec ON u_rec.user_id = c.receiver_id
      WHERE c.status = 'ACCEPTED'
        AND ((c.requester_id = $1 AND c.receiver_id = $2)
          OR (c.requester_id = $2 AND c.receiver_id = $1))`,
    [userId1, userId2]
  );
  return rows[0];
}

module.exports = {
  create,
  findById,
  findBetweenUsers,
  updateStatus,
  listForUser,
  getAcceptedConnection,
};
