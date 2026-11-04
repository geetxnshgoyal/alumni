const { pool, query } = require('../../db/pool');
const { toLimitOffset } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');

const DONATION_COLUMNS = `
  d.donation_id AS "donationId",
  d.campaign_id AS "campaignId",
  d.donor_id AS "donorId",
  d.amount::float AS "amount",
  d.currency,
  d.is_anonymous AS "isAnonymous",
  d.donation_status AS "donationStatus",
  d.created_at AS "createdAt",
  c.title AS "campaignTitle",
  c.status AS "campaignStatus",
  u.full_name AS "donorName",
  u.email AS "donorEmail",
  pt.transaction_id AS "transactionId",
  pt.gateway,
  pt.gateway_order_id AS "gatewayOrderId",
  pt.gateway_payment_id AS "gatewayPaymentId",
  pt.status AS "transactionStatus",
  dr.receipt_no AS "receiptNo",
  dr.issued_at AS "receiptIssuedAt"
`;

/**
 * Retrieves a single donation with its linked transaction, campaign and receipt.
 */
async function findById(donationId) {
  const { rows } = await query(
    `SELECT ${DONATION_COLUMNS}
       FROM donation d
       JOIN campaign c ON c.campaign_id = d.campaign_id
       JOIN users u ON u.user_id = d.donor_id
  LEFT JOIN payment_transaction pt ON pt.donation_id = d.donation_id
  LEFT JOIN donation_receipt dr ON dr.donation_id = d.donation_id
      WHERE d.donation_id = $1`,
    [donationId]
  );
  return rows[0] || null;
}

/**
 * Looks up a donation by gateway order ID.
 */
async function findByOrderId(gatewayOrderId) {
  const { rows } = await query(
    `SELECT ${DONATION_COLUMNS}
       FROM donation d
       JOIN campaign c ON c.campaign_id = d.campaign_id
       JOIN users u ON u.user_id = d.donor_id
       JOIN payment_transaction pt ON pt.donation_id = d.donation_id
  LEFT JOIN donation_receipt dr ON dr.donation_id = d.donation_id
      WHERE pt.gateway_order_id = $1`,
    [gatewayOrderId]
  );
  return rows[0] || null;
}

/**
 * Creates a new donation and its corresponding payment transaction atomically.
 */
async function createOrder({ campaignId, donorId, amount, currency = 'INR', isAnonymous = false, gateway = 'RAZORPAY', gatewayOrderId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify campaign exists and is actively accepting contributions
    const { rows: campRows } = await client.query(
      `SELECT campaign_id, title, status, end_date
         FROM campaign
        WHERE campaign_id = $1
          FOR SHARE`,
      [campaignId]
    );

    if (campRows.length === 0) {
      throw ApiError.notFound('Campaign not found');
    }

    const campaign = campRows[0];
    if (campaign.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Campaign is not active for donations (status: ${campaign.status})`);
    }

    // 2. Insert donation with status INITIATED
    const { rows: donRows } = await client.query(
      `INSERT INTO donation (campaign_id, donor_id, amount, currency, is_anonymous, donation_status)
       VALUES ($1, $2, $3, $4, $5, 'INITIATED')
       RETURNING donation_id AS "donationId", campaign_id AS "campaignId",
                 donor_id AS "donorId", amount::float AS "amount",
                 currency, is_anonymous AS "isAnonymous",
                 donation_status AS "donationStatus", created_at AS "createdAt"`,
      [campaignId, donorId, amount, currency, isAnonymous]
    );
    const donation = donRows[0];

    // 3. Insert payment_transaction linked to the donation
    const { rows: txRows } = await client.query(
      `INSERT INTO payment_transaction (donation_id, gateway, gateway_order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'INITIATED')
       RETURNING transaction_id AS "transactionId", gateway,
                 gateway_order_id AS "gatewayOrderId", amount::float AS "amount",
                 currency, status AS "transactionStatus", created_at AS "createdAt"`,
      [donation.donationId, gateway, gatewayOrderId, amount, currency]
    );
    const transaction = txRows[0];

    await client.query('COMMIT');

    return {
      ...donation,
      campaignTitle: campaign.title,
      transaction,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transitions donation and transaction to SUCCESS upon valid payment signature.
 * Automatically provisions a receipt number in the same atomic transaction.
 */
async function recordPaymentSuccess({ donationId, gatewayOrderId, gatewayPaymentId, signature }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock donation record
    const { rows: donRows } = await client.query(
      `SELECT d.donation_id, d.donation_status, pt.gateway_order_id
         FROM donation d
         JOIN payment_transaction pt ON pt.donation_id = d.donation_id
        WHERE d.donation_id = $1
          FOR UPDATE OF d`,
      [donationId]
    );

    if (donRows.length === 0) {
      throw ApiError.notFound('Donation record not found');
    }

    const current = donRows[0];
    if (current.gateway_order_id !== gatewayOrderId) {
      throw ApiError.badRequest('Gateway order ID does not match this donation record');
    }

    // Idempotent: if already successful, simply return without re-updating
    if (current.donation_status === 'SUCCESS') {
      await client.query('COMMIT');
      return findById(donationId);
    }

    if (current.donation_status === 'FAILED') {
      throw ApiError.conflict('Cannot mark an already failed donation as successful');
    }

    // Update payment_transaction
    await client.query(
      `UPDATE payment_transaction
          SET status = 'SUCCESS',
              gateway_payment_id = $1,
              signature = $2
        WHERE donation_id = $3
          AND gateway_order_id = $4`,
      [gatewayPaymentId, signature, donationId, gatewayOrderId]
    );

    // Update donation status
    await client.query(
      `UPDATE donation
          SET donation_status = 'SUCCESS'
        WHERE donation_id = $1`,
      [donationId]
    );

    // Generate unique receipt number (REC-YYYY-XXXXXX)
    const year = new Date().getFullYear();
    const receiptNo = `REC-${year}-${String(donationId).padStart(6, '0')}`;
    await client.query(
      `INSERT INTO donation_receipt (donation_id, receipt_no)
       VALUES ($1, $2)
       ON CONFLICT (donation_id) DO NOTHING`,
      [donationId, receiptNo]
    );

    await client.query('COMMIT');

    return findById(donationId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transitions donation and transaction to FAILED when payment fails or is rejected.
 */
async function recordPaymentFailure({ donationId, gatewayOrderId, reason }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: donRows } = await client.query(
      `SELECT d.donation_id, d.donation_status, pt.gateway_order_id
         FROM donation d
         JOIN payment_transaction pt ON pt.donation_id = d.donation_id
        WHERE d.donation_id = $1
          FOR UPDATE OF d`,
      [donationId]
    );

    if (donRows.length === 0) {
      throw ApiError.notFound('Donation record not found');
    }

    const current = donRows[0];
    if (current.gateway_order_id !== gatewayOrderId) {
      throw ApiError.badRequest('Gateway order ID does not match this donation record');
    }

    if (current.donation_status === 'SUCCESS') {
      throw ApiError.conflict('Cannot mark an already settled donation as failed');
    }

    await client.query(
      `UPDATE payment_transaction
          SET status = 'FAILED'
        WHERE donation_id = $1
          AND gateway_order_id = $2`,
      [donationId, gatewayOrderId]
    );

    await client.query(
      `UPDATE donation
          SET donation_status = 'FAILED'
        WHERE donation_id = $1`,
      [donationId]
    );

    await client.query('COMMIT');

    return findById(donationId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns paginated donations for a specific donor.
 */
async function listByDonor({ donorId, page = 1, limit = 20 }) {
  const { limit: l, offset } = toLimitOffset({ page, limit });

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM donation
      WHERE donor_id = $1`,
    [donorId]
  );

  const { rows } = await query(
    `SELECT ${DONATION_COLUMNS}
       FROM donation d
       JOIN campaign c ON c.campaign_id = d.campaign_id
       JOIN users u ON u.user_id = d.donor_id
  LEFT JOIN payment_transaction pt ON pt.donation_id = d.donation_id
  LEFT JOIN donation_receipt dr ON dr.donation_id = d.donation_id
      WHERE d.donor_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
    [donorId, l, offset]
  );

  return {
    items: rows,
    total: countRows[0].total,
    page: Number(page),
    limit: l,
  };
}

/**
 * Returns public donor wall for a campaign with privacy masking for anonymous donors.
 */
async function listByCampaign({ campaignId, page = 1, limit = 20, viewerUserId = null, isAdmin = false }) {
  const { limit: l, offset } = toLimitOffset({ page, limit });

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM donation
      WHERE campaign_id = $1
        AND donation_status = 'SUCCESS'`,
    [campaignId]
  );

  const { rows } = await query(
    `SELECT d.donation_id AS "donationId",
            d.campaign_id AS "campaignId",
            d.amount::float AS "amount",
            d.currency,
            d.is_anonymous AS "isAnonymous",
            d.created_at AS "createdAt",
            CASE
              WHEN d.is_anonymous = true AND $2::int IS DISTINCT FROM d.donor_id AND $3::boolean = false
              THEN 'Anonymous Donor'
              ELSE u.full_name
            END AS "donorName"
       FROM donation d
       JOIN users u ON u.user_id = d.donor_id
      WHERE d.campaign_id = $1
        AND d.donation_status = 'SUCCESS'
      ORDER BY d.created_at DESC
      LIMIT $4 OFFSET $5`,
    [campaignId, viewerUserId, isAdmin, l, offset]
  );

  return {
    items: rows,
    total: countRows[0].total,
    page: Number(page),
    limit: l,
  };
}

module.exports = {
  findById,
  findByOrderId,
  createOrder,
  recordPaymentSuccess,
  recordPaymentFailure,
  listByDonor,
  listByCampaign,
};
