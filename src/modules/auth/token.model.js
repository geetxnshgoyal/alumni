const crypto = require('crypto');
const { query, pool } = require('../../db/pool');

/**
 * Modern Authentication Token Management (Lecture 16)
 * Implements Access + Refresh token separation, token rotation,
 * and family-based replay / reuse detection.
 */

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Creates and stores a new refresh token.
 * Stores only the SHA-256 hash in database to prevent leakage in case of DB compromise.
 */
async function createRefreshToken({ userId, familyId = null, client = null, expiresInDays = 7 }) {
  const runner = client || { query };
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const activeFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const { rows } = await runner.query(
    `INSERT INTO refresh_token (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING token_id, user_id, family_id, expires_at, created_at`,
    [userId, tokenHash, activeFamilyId, expiresAt]
  );

  return {
    rawToken,
    tokenId: rows[0].token_id,
    familyId: rows[0].family_id,
    expiresAt: rows[0].expires_at,
  };
}

/**
 * Rotates a refresh token (Lecture 16 Slide 14 & 15).
 * - Verifies current token hash.
 * - Detects reuse: if an already-revoked token is presented, revokes the entire family!
 * - If valid, revokes old token and issues a new token in the same family.
 */
async function rotateRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT rt.token_id, rt.user_id, rt.family_id, rt.is_revoked, rt.expires_at, rt.replaced_by,
              u.email, u.full_name, u.role, u.account_status
         FROM refresh_token rt
         JOIN users u ON u.user_id = rt.user_id
        WHERE rt.token_hash = $1
          FOR UPDATE OF rt`,
      [tokenHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 'INVALID_TOKEN' };
    }

    const tokenRecord = rows[0];

    // 1. Replay / Reuse Detection (Slide 15)
    // If a token that was already replaced/rotated is presented again, token theft is detected!
    if (tokenRecord.is_revoked) {
      if (tokenRecord.replaced_by) {
        await client.query(
          `UPDATE refresh_token
              SET is_revoked = TRUE
            WHERE family_id = $1`,
          [tokenRecord.family_id]
        );
        await client.query('COMMIT');
        return {
          status: 'REUSE_DETECTED',
          userId: tokenRecord.user_id,
          familyId: tokenRecord.family_id,
        };
      }

      // If revoked without replacement (e.g. explicitly logged out)
      await client.query('ROLLBACK');
      return { status: 'REVOKED' };
    }

    // 2. Check Expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await client.query(
        `UPDATE refresh_token SET is_revoked = TRUE WHERE token_id = $1`,
        [tokenRecord.token_id]
      );
      await client.query('COMMIT');
      return { status: 'EXPIRED' };
    }

    // 3. Check User Account Status
    if (tokenRecord.account_status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return { status: 'USER_INACTIVE', accountStatus: tokenRecord.account_status };
    }

    // 4. Rotate: Issue new token in same family and mark old token revoked & replaced
    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { rows: newRows } = await client.query(
      `INSERT INTO refresh_token (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING token_id`,
      [tokenRecord.user_id, newTokenHash, tokenRecord.family_id, newExpiresAt]
    );

    const newTokenId = newRows[0].token_id;

    await client.query(
      `UPDATE refresh_token
          SET is_revoked = TRUE,
              replaced_by = $1
        WHERE token_id = $2`,
      [newTokenId, tokenRecord.token_id]
    );

    await client.query('COMMIT');

    return {
      status: 'SUCCESS',
      user: {
        userId: tokenRecord.user_id,
        email: tokenRecord.email,
        fullName: tokenRecord.full_name,
        role: tokenRecord.role,
      },
      newRawToken,
      familyId: tokenRecord.family_id,
      expiresAt: newExpiresAt,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revokes a single refresh token (used on Logout).
 */
async function revokeRefreshToken(rawToken) {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);
  const { rowCount } = await query(
    `UPDATE refresh_token
        SET is_revoked = TRUE
      WHERE token_hash = $1`,
    [tokenHash]
  );
  return rowCount > 0;
}

/**
 * Revokes all refresh tokens for a user (used on Password Change or Security Lockout).
 */
async function revokeAllUserTokens(userId) {
  const { rowCount } = await query(
    `UPDATE refresh_token
        SET is_revoked = TRUE
      WHERE user_id = $1`,
    [userId]
  );
  return rowCount;
}

module.exports = {
  hashToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
