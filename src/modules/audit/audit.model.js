const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

async function log({ actorId = null, action, entityName, entityId = null, outcome = 'SUCCESS', errorCode = null, ip = null }, db = { query }) {
  await db.query(
    `INSERT INTO audit_log (actor_id, action, entity_name, entity_id, outcome, error_code, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actorId, action, entityName, entityId, outcome, errorCode, ip]
  );
}

async function list({ page = 1, limit = 20, action, outcome, from, to } = {}) {
  const conditions = [];
  const values = [];

  if (action) {
    values.push(action);
    conditions.push(`al.action = $${values.length}`);
  }
  if (outcome) {
    values.push(outcome);
    conditions.push(`al.outcome = $${values.length}`);
  }
  if (from) {
    values.push(from);
    conditions.push(`al.created_at >= $${values.length}::date`);
  }
  if (to) {
    values.push(to);
    conditions.push(`al.created_at < $${values.length}::date + 1`); // whole "to" day included
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM audit_log al ${where}`, values);
  const total = countRows[0].total;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  values.push(lim, offset);

  const { rows } = await query(
    `SELECT al.log_id AS "logId", al.actor_id AS "actorId", u.email AS "actorEmail",
            al.action, al.entity_name AS "entityName", al.entity_id AS "entityId",
            al.outcome, al.error_code AS "errorCode", al.ip_address AS "ipAddress",
            al.created_at AS "createdAt"
       FROM audit_log al
       LEFT JOIN users u ON u.user_id = al.actor_id
      ${where}
      ORDER BY al.created_at DESC, al.log_id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows, total };
}

module.exports = { log, list };
