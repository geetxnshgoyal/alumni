const { query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');

const AGGREGATE_FIELDS = `
  COALESCE((
    SELECT SUM(d.amount)::numeric(12, 2)
      FROM donation d
     WHERE d.campaign_id = c.campaign_id
       AND d.donation_status = 'SUCCESS'
  ), 0.00)::float AS "amountRaised",
  COALESCE((
    SELECT COUNT(DISTINCT d.donor_id)::int
      FROM donation d
     WHERE d.campaign_id = c.campaign_id
       AND d.donation_status = 'SUCCESS'
  ), 0)::int AS "donorCount"
`;

const COLUMNS = `c.campaign_id AS "campaignId",
                 c.created_by AS "createdBy",
                 c.title,
                 c.description,
                 c.goal_amount::float AS "goalAmount",
                 c.start_date AS "startDate",
                 c.end_date AS "endDate",
                 c.status,
                 c.created_at AS "createdAt",
                 c.updated_at AS "updatedAt",
                 u.full_name AS "creatorName",
                 ${AGGREGATE_FIELDS}`;

async function findById(campaignId) {
  const { rows } = await query(
    `SELECT ${COLUMNS}
       FROM campaign c
       JOIN users u ON u.user_id = c.created_by
      WHERE c.campaign_id = $1`,
    [campaignId]
  );
  return rows[0];
}

async function create({ createdBy, title, description, goalAmount, startDate, endDate, status = 'ACTIVE' }) {
  const { rows } = await query(
    `INSERT INTO campaign (created_by, title, description, goal_amount, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING campaign_id AS "campaignId", created_by AS "createdBy", title,
               description, goal_amount::float AS "goalAmount", start_date AS "startDate",
               end_date AS "endDate", status, created_at AS "createdAt"`,
    [createdBy, title, description, goalAmount, startDate, endDate, status]
  );
  return rows[0];
}

async function update(campaignId, fields) {
  const sets = [];
  const values = [campaignId];

  const map = {
    title: 'title',
    description: 'description',
    goalAmount: 'goal_amount',
    startDate: 'start_date',
    endDate: 'end_date',
    status: 'status',
  };

  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }

  sets.push('updated_at = NOW()');

  await query(
    `UPDATE campaign
        SET ${sets.join(', ')}
      WHERE campaign_id = $1`,
    values
  );

  return findById(campaignId);
}

async function updateStatus(campaignId, status) {
  await query(
    `UPDATE campaign
        SET status = $2, updated_at = NOW()
      WHERE campaign_id = $1`,
    [campaignId, status]
  );
  return findById(campaignId);
}

async function list({ status, page, limit }) {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`c.status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM campaign c ${whereClause}`,
    values
  );
  const total = countRows[0]?.total || 0;

  const { limit: lim, offset } = toLimitOffset({ page, limit });
  const pagingValues = [...values, lim, offset];

  const { rows } = await query(
    `SELECT ${COLUMNS}
       FROM campaign c
       JOIN users u ON u.user_id = c.created_by
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${pagingValues.length - 1} OFFSET $${pagingValues.length}`,
    pagingValues
  );

  return { rows, total };
}

module.exports = {
  findById,
  create,
  update,
  updateStatus,
  list,
};
