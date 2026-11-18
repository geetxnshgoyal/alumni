const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');
const { likePattern } = require('../../utils/sql');

const EVENT_COLUMNS = `
  e.event_id AS "eventId",
  e.created_by AS "createdBy",
  e.title,
  e.description,
  e.event_type AS "eventType",
  e.mode,
  e.venue_or_link AS "venueOrLink",
  e.start_at AS "startAt",
  e.end_at AS "endAt",
  e.capacity,
  e.registration_deadline AS "registrationDeadline",
  e.status,
  e.created_at AS "createdAt",
  u.full_name AS "creatorName",
  u.email AS "creatorEmail",
  COALESCE(counts.registered_count, 0)::int AS "registeredCount",
  COALESCE(counts.waitlisted_count, 0)::int AS "waitlistedCount"
`;

const COUNTS_JOIN = `
  LEFT JOIN (
    SELECT event_id,
           COUNT(*) FILTER (WHERE reg_status = 'REGISTERED')::int AS registered_count,
           COUNT(*) FILTER (WHERE reg_status = 'WAITLISTED')::int AS waitlisted_count
      FROM event_registration
     GROUP BY event_id
  ) counts ON counts.event_id = e.event_id
`;

const REGISTRATION_COLUMNS = `
  er.registration_id AS "registrationId",
  er.event_id AS "eventId",
  er.user_id AS "userId",
  er.reg_status AS "regStatus",
  er.registered_at AS "registeredAt",
  er.attended,
  u.full_name AS "fullName",
  u.email,
  u.role,
  e.title AS "eventTitle",
  e.start_at AS "startAt",
  e.mode,
  e.venue_or_link AS "venueOrLink"
`;

// Creates a new event (admin only).
async function create(
  {
    createdBy,
    title,
    description,
    eventType,
    mode,
    venueOrLink,
    startAt,
    endAt,
    capacity,
    registrationDeadline = null,
    status = 'DRAFT',
  },
  db = { query }
) {
  const { rows } = await db.query(
    `INSERT INTO event (created_by, title, description, event_type, mode, venue_or_link, start_at, end_at, capacity, registration_deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING event_id AS "eventId", created_by AS "createdBy", title, description,
               event_type AS "eventType", mode, venue_or_link AS "venueOrLink",
               start_at AS "startAt", end_at AS "endAt", capacity,
               registration_deadline AS "registrationDeadline", status, created_at AS "createdAt"`,
    [
      createdBy,
      title,
      description,
      eventType,
      mode,
      venueOrLink,
      startAt,
      endAt,
      capacity,
      registrationDeadline,
      status,
    ]
  );
  return rows[0];
}

// Finds an event by ID with counts and creator details.
async function findById(eventId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${EVENT_COLUMNS}
       FROM event e
       JOIN users u ON u.user_id = e.created_by
       ${COUNTS_JOIN}
      WHERE e.event_id = $1`,
    [eventId]
  );
  return rows[0];
}

// Lists events with filters and pagination.
async function list(
  { type, mode, status, q, page = 1, limit = 20, includeDrafts = false } = {},
  db = { query }
) {
  const conditions = [];
  const values = [];

  if (!includeDrafts && !status) {
    conditions.push(`e.status != 'DRAFT'`);
  }

  if (type) {
    values.push(type);
    conditions.push(`e.event_type = $${values.length}`);
  }

  if (mode) {
    values.push(mode);
    conditions.push(`e.mode = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`e.status = $${values.length}`);
  }

  if (q) {
    values.push(likePattern(q));
    conditions.push(
      `(e.title ILIKE $${values.length} OR e.description ILIKE $${values.length} OR e.venue_or_link ILIKE $${values.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM event e ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  const pagingValues = [...values, lim, offset];

  const { rows } = await db.query(
    `SELECT ${EVENT_COLUMNS}
       FROM event e
       JOIN users u ON u.user_id = e.created_by
       ${COUNTS_JOIN}
      ${whereClause}
      ORDER BY e.start_at ASC, e.event_id DESC
      LIMIT $${pagingValues.length - 1} OFFSET $${pagingValues.length}`,
    pagingValues
  );

  return { rows, total };
}

// Updates an event.
async function update(eventId, fields, db = { query }) {
  const map = {
    title: 'title',
    description: 'description',
    eventType: 'event_type',
    mode: 'mode',
    venueOrLink: 'venue_or_link',
    startAt: 'start_at',
    endAt: 'end_at',
    capacity: 'capacity',
    registrationDeadline: 'registration_deadline',
    status: 'status',
  };

  const sets = [];
  const values = [eventId];

  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }

  if (!sets.length) return findById(eventId, db);

  await db.query(
    `UPDATE event
        SET ${sets.join(', ')}
      WHERE event_id = $1`,
    values
  );

  return findById(eventId, db);
}

// Deletes an event.
async function deleteEvent(eventId, db = { query }) {
  const { rowCount } = await db.query('DELETE FROM event WHERE event_id = $1', [eventId]);
  return rowCount > 0;
}

// Finds an existing registration for user and event.
async function findRegistration(eventId, userId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${REGISTRATION_COLUMNS}
       FROM event_registration er
       JOIN users u ON u.user_id = er.user_id
       JOIN event e ON e.event_id = er.event_id
      WHERE er.event_id = $1 AND er.user_id = $2`,
    [eventId, userId]
  );
  return rows[0];
}

// Lists registrations for an event.
async function listRegistrationsForEvent(eventId, { page = 1, limit = 50, status } = {}, db = { query }) {
  const conditions = ['er.event_id = $1'];
  const values = [eventId];

  if (status) {
    values.push(status);
    conditions.push(`er.reg_status = $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM event_registration er ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await db.query(
    `SELECT ${REGISTRATION_COLUMNS}
       FROM event_registration er
       JOIN users u ON u.user_id = er.user_id
       JOIN event e ON e.event_id = er.event_id
      ${whereClause}
      ORDER BY er.registered_at ASC, er.registration_id ASC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

// Lists events registered by a user.
async function listRegistrationsForUser(userId, { page = 1, limit = 20 } = {}, db = { query }) {
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM event_registration er WHERE er.user_id = $1 AND er.reg_status != 'CANCELLED'`,
    [userId]
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });

  const { rows } = await db.query(
    `SELECT ${REGISTRATION_COLUMNS}
       FROM event_registration er
       JOIN users u ON u.user_id = er.user_id
       JOIN event e ON e.event_id = er.event_id
      WHERE er.user_id = $1 AND er.reg_status != 'CANCELLED'
      ORDER BY e.start_at ASC
      LIMIT $2 OFFSET $3`,
    [userId, lim, offset]
  );

  return { rows, total };
}

module.exports = {
  create,
  findById,
  list,
  update,
  deleteEvent,
  findRegistration,
  listRegistrationsForEvent,
  listRegistrationsForUser,
};
