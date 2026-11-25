const ApiError = require('../../utils/ApiError');
const { paginationMeta } = require('../../utils/pagination');
const { withTransaction } = require('../../db/pool');
const events = require('./events.model');
const notifications = require('../notifications/notifications.model');
const audit = require('../audit/audit.model');

// Valid status transitions
const ALLOWED_TRANSITIONS = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// POST /api/events (admin only)
async function create(req, res) {
  const event = await events.create({
    createdBy: req.user.id,
    ...req.valid.body,
  });
  await audit.log({ actorId: req.user.id, action: 'EVENT_CREATE', entityName: 'event', entityId: event.eventId, ip: req.ip });
  res.status(201).json({ data: event });
}

// GET /api/events (public/authenticated)
async function list(req, res) {
  const isAdmin = req.user?.role === 'ADMIN';
  const query = req.valid?.query || { page: 1, limit: 20 };
  const { rows, total } = await events.list({
    ...query,
    includeDrafts: isAdmin,
  });
  const pagination = paginationMeta(query, total);
  res.json({ data: rows, pagination, meta: pagination });
}

// GET /api/events/:id (public/authenticated)
async function getById(req, res) {
  const event = await events.findById(req.valid.params.id);
  if (!event) {
    throw ApiError.notFound('Event not found');
  }

  if (event.status === 'DRAFT' && req.user?.role !== 'ADMIN') {
    throw ApiError.notFound('Event not found');
  }

  res.json({ data: event });
}

// PATCH /api/events/:id (admin only)
async function update(req, res) {
  const { id } = req.valid.params;
  const existing = await events.findById(id);
  if (!existing) {
    throw ApiError.notFound('Event not found');
  }

  const { status, startAt, endAt, registrationDeadline } = req.valid.body;

  // Status flow validation: DRAFT -> OPEN -> COMPLETED/CANCELLED
  if (status && status !== existing.status) {
    const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(
        `Cannot transition event status from ${existing.status} to ${status}`
      );
    }
  }

  // Cross-field date validation with existing data
  const finalStart = startAt ? new Date(startAt) : new Date(existing.startAt);
  const finalEnd = endAt ? new Date(endAt) : new Date(existing.endAt);
  if (finalEnd <= finalStart) {
    throw ApiError.badRequest('End date must be after start date');
  }

  const rawDeadline =
    registrationDeadline !== undefined ? registrationDeadline : existing.registrationDeadline;
  if (rawDeadline) {
    const finalDeadline = new Date(rawDeadline);
    if (finalDeadline > finalStart) {
      throw ApiError.badRequest('Registration deadline must be on or before event start date');
    }
  }

  const updated = await events.update(id, req.valid.body);
  await audit.log({ actorId: req.user.id, action: 'EVENT_UPDATE', entityName: 'event', entityId: id, ip: req.ip });
  res.json({ data: updated });
}

// DELETE /api/events/:id (admin only)
async function remove(req, res) {
  const { id } = req.valid.params;
  const existing = await events.findById(id);
  if (!existing) {
    throw ApiError.notFound('Event not found');
  }

  await events.deleteEvent(id);
  await audit.log({ actorId: req.user.id, action: 'EVENT_DELETE', entityName: 'event', entityId: id, ip: req.ip });
  res.json({ data: { message: 'Event deleted successfully' } });
}

// PATCH /api/events/:id/cancel (admin only)
async function cancelEvent(req, res) {
  const { id } = req.valid.params;
  const existing = await events.findById(id);
  if (!existing) {
    throw ApiError.notFound('Event not found');
  }

  if (existing.status === 'CANCELLED') {
    return res.json({ data: existing });
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
  if (!allowed.includes('CANCELLED')) {
    throw ApiError.badRequest(
      `Cannot cancel an event that is already ${existing.status}`
    );
  }

  const updated = await events.update(id, { status: 'CANCELLED' });
  await audit.log({ actorId: req.user.id, action: 'EVENT_CANCEL', entityName: 'event', entityId: id, ip: req.ip });
  res.json({ data: updated });
}

// POST /api/events/:id/register (authenticated)
async function register(req, res) {
  const { id: eventId } = req.valid.params;
  const userId = req.user.id;

  const registration = await withTransaction(async (client) => {
    // Lock event row
    const { rows: eventRows } = await client.query(
      'SELECT * FROM event WHERE event_id = $1 FOR UPDATE',
      [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    if (event.status !== 'OPEN') {
      throw ApiError.badRequest('Cannot register for an event that is not open');
    }

    // Check deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      throw ApiError.badRequest('Registration deadline has passed');
    }

    // Check existing registration
    const { rows: existingRows } = await client.query(
      'SELECT * FROM event_registration WHERE event_id = $1 AND user_id = $2 FOR UPDATE',
      [eventId, userId]
    );
    const existing = existingRows[0];

    if (existing && existing.reg_status !== 'CANCELLED') {
      throw ApiError.conflict('You are already registered for this event');
    }

    // Count confirmed attendees
    const { rows: countRows } = await client.query(
      "SELECT COUNT(*)::int AS count FROM event_registration WHERE event_id = $1 AND reg_status = 'REGISTERED'",
      [eventId]
    );
    const confirmedCount = countRows[0].count;

    const newStatus = confirmedCount < event.capacity ? 'REGISTERED' : 'WAITLISTED';

    let reg;
    if (existing) {
      const { rows: updatedRows } = await client.query(
        `UPDATE event_registration
            SET reg_status = $1, registered_at = NOW(), attended = FALSE
          WHERE registration_id = $2
          RETURNING registration_id AS "registrationId", event_id AS "eventId", user_id AS "userId",
                    reg_status AS "regStatus", registered_at AS "registeredAt", attended`,
        [newStatus, existing.registration_id]
      );
      reg = updatedRows[0];
    } else {
      const { rows: insertedRows } = await client.query(
        `INSERT INTO event_registration (event_id, user_id, reg_status, registered_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING registration_id AS "registrationId", event_id AS "eventId", user_id AS "userId",
                   reg_status AS "regStatus", registered_at AS "registeredAt", attended`,
        [eventId, userId, newStatus]
      );
      reg = insertedRows[0];
    }

    await notifications.notify(
      userId,
      {
        type: 'EVENT_REGISTRATION',
        title: newStatus === 'REGISTERED' ? `Confirmed: ${event.title}` : `Waitlisted: ${event.title}`,
        body:
          newStatus === 'REGISTERED'
            ? `Your registration for "${event.title}" is confirmed.`
            : `The event is currently at full capacity. You have been placed on the waitlist.`,
        linkUrl: `#/events/${eventId}`,
      },
      client
    );

    return reg;
  });

  res.status(201).json({ data: registration });
}

// DELETE /api/events/:id/register (authenticated)
async function cancelRegistration(req, res) {
  const { id: eventId } = req.valid.params;
  const userId = req.user.id;

  const result = await withTransaction(async (client) => {
    // Lock event row
    const { rows: eventRows } = await client.query(
      'SELECT * FROM event WHERE event_id = $1 FOR UPDATE',
      [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Lock registration row
    const { rows: regRows } = await client.query(
      'SELECT * FROM event_registration WHERE event_id = $1 AND user_id = $2 FOR UPDATE',
      [eventId, userId]
    );
    const reg = regRows[0];
    if (!reg || reg.reg_status === 'CANCELLED') {
      throw ApiError.notFound('Active registration not found');
    }

    const wasRegistered = reg.reg_status === 'REGISTERED';

    // Mark as cancelled
    await client.query(
      "UPDATE event_registration SET reg_status = 'CANCELLED' WHERE registration_id = $1",
      [reg.registration_id]
    );

    let promotedUser = null;

    // Promote the next waitlisted person if spot opened up
    if (wasRegistered) {
      const { rows: waitlistRows } = await client.query(
        `SELECT er.*, u.full_name, u.email
           FROM event_registration er
           JOIN users u ON u.user_id = er.user_id
          WHERE er.event_id = $1 AND er.reg_status = 'WAITLISTED'
          ORDER BY er.registered_at ASC, er.registration_id ASC
          LIMIT 1
          FOR UPDATE`,
        [eventId]
      );

      if (waitlistRows.length > 0) {
        const nextPerson = waitlistRows[0];
        await client.query(
          "UPDATE event_registration SET reg_status = 'REGISTERED' WHERE registration_id = $1",
          [nextPerson.registration_id]
        );
        promotedUser = nextPerson;

        // Notify promoted person
        await notifications.notify(
          nextPerson.user_id,
          {
            type: 'EVENT_REGISTRATION',
            title: `Promoted from waitlist: ${event.title}`,
            body: `A spot opened up! Your registration for "${event.title}" is now confirmed.`,
            linkUrl: `#/events/${eventId}`,
          },
          client
        );
      }
    }

    return {
      message: 'Registration cancelled',
      promotedUserId: promotedUser ? promotedUser.user_id : null,
    };
  });

  res.json({ data: result });
}

// GET /api/events/:id/registrations (admin only)
async function listRegistrations(req, res) {
  const { id } = req.valid.params;
  const event = await events.findById(id);
  if (!event) {
    throw ApiError.notFound('Event not found');
  }

  const query = req.valid?.query || { page: 1, limit: 50 };
  const { rows, total } = await events.listRegistrationsForEvent(id, query);
  const pagination = paginationMeta(query, total);
  res.json({ data: rows, pagination, meta: pagination });
}

// GET /api/events/registrations/me (authenticated)
async function myRegistrations(req, res) {
  const query = req.valid?.query || { page: 1, limit: 20 };
  const { rows, total } = await events.listRegistrationsForUser(req.user.id, query);
  const pagination = paginationMeta(query, total);
  res.json({ data: rows, pagination, meta: pagination });
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  cancelEvent,
  register,
  cancelRegistration,
  listRegistrations,
  myRegistrations,
};
