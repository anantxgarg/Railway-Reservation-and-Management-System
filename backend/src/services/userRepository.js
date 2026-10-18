/**
 * userRepository.js — All direct database access for the users/auth domain.
 *
 * Every function uses parameterised queries (pg's $1, $2, … placeholders).
 * No SQL is built by string concatenation (the only interpolated fragment is
 * the constant UTC_NOW expression below).
 *
 * Schema source of truth: database/c1-identity/schema.sql
 *   + schema_auth_tokens.sql (proposed token tables)
 *
 * Key DB contracts honoured here:
 *  - email is always normalised (lower + trim) before INSERT and SELECT
 *  - password_hash must already be bcrypt-formatted (schema CHECK enforces this)
 *  - user_id is GENERATED ALWAYS — never supplied in INSERT
 *  - Permission check uses the user_permissions VIEW
 *  - Refresh/reset tokens: store encode(sha256(raw), 'hex') — 64 hex chars
 *
 * Time policy: token tables use TIMESTAMP WITHOUT TIME ZONE. Every value this
 * module writes to them (created_at, expires_at, revoked_at, used_at) and every
 * comparison against them uses UTC_NOW, i.e. the UTC wall clock computed by the
 * database. Nothing depends on the Node or PostgreSQL session time zone, and
 * TTLs are passed as seconds instead of JS Dates. See config/db.js.
 *
 * Atomicity: multi-step flows (refresh rotation, password reset, password
 * change) run inside db.withTransaction and use row locks / conditional
 * UPDATEs, so concurrent requests cannot both succeed.
 */
'use strict';

const crypto = require('crypto');
const db     = require('../config/db');
const { normaliseEmail } = require('../utils/email');

/** UTC wall-clock "now" as a TIMESTAMP (no zone), computed by PostgreSQL. */
const UTC_NOW = "(now() AT TIME ZONE 'UTC')";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SHA-256 hex digest of a raw token — what gets stored in the DB.
 * The raw token is never stored.
 * @param {string} raw
 * @returns {string} 64 lower-case hex chars
 */
function sha256hex(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

/** Run a query on a transaction client when given, else on the pool. */
function run(client, sql, params) {
  return (client || db).query(sql, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// User lookups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find a user by e-mail (normalised). Returns the full row including
 * password_hash — ONLY used internally for authentication; never send
 * this object to the client.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const { rows } = await db.query(
    `SELECT u.user_id, u.role_id, u.name, u.email, u.phone,
            u.password_hash, u.status, u.created_at, u.updated_at,
            u.last_login_at, u.failed_login_attempts,
            r.role_name
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = $1`,
    [normaliseEmail(email)]
  );
  return rows[0] || null;
}

/**
 * Find a user by user_id. Returns safe public fields only — no password_hash.
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function findById(userId) {
  const { rows } = await db.query(
    `SELECT u.user_id, u.name, u.email, u.phone, u.status,
            u.created_at, u.updated_at, u.last_login_at,
            r.role_name
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Load only what a password check needs for an authenticated user.
 * @param {number} userId
 * @returns {Promise<{password_hash:string, status:string}|null>}
 */
async function findPasswordRecord(userId) {
  const { rows } = await db.query(
    `SELECT password_hash, status FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// User creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a new CUSTOMER user.
 * The role is resolved from the seeded roles table — the caller cannot choose it.
 * Omits status, failed_login_attempts, and timestamps — DB defaults apply.
 * Returns only safe public fields (no password_hash).
 *
 * @param {{name:string, email:string, phone:string|null, passwordHash:string}} params
 * @returns {Promise<object>} created user safe fields
 */
async function createCustomer({ name, email, phone, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO users (role_id, name, email, phone, password_hash)
     SELECT r.role_id, $1, $2, $3, $4
     FROM roles r
     WHERE r.role_name = 'CUSTOMER'
     RETURNING user_id, name, email, phone, status, created_at`,
    [name.trim(), normaliseEmail(email), phone || null, passwordHash]
  );
  if (!rows.length) {
    throw new Error('CUSTOMER role not found in database. Run seed.sql first.');
  }
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Login-related updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update last_login_at and reset failed_login_attempts on successful login.
 * Only touches ACTIVE accounts, so it doubles as a last-moment status check.
 *
 * @param {number} userId
 * @returns {Promise<boolean>} true if the account was ACTIVE and was updated
 */
async function recordSuccessfulLogin(userId) {
  const res = await db.query(
    `UPDATE users
     SET last_login_at = now(), failed_login_attempts = 0
     WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId]
  );
  return res.rowCount === 1;
}

/**
 * Count a failed password attempt and, when the threshold is reached, apply
 * the security lockout (status ACTIVE → LOCKED).
 *
 * The UPDATE is restricted to ACTIVE accounts, so:
 *   - SUSPENDED / INACTIVE / PENDING / already-LOCKED accounts are NEVER
 *     modified (an administrator-imposed status can't be overwritten by a
 *     login attempt);
 *   - concurrent failures serialise on the row lock and each sees the fresh
 *     counter, so the threshold can't be skipped by racing requests.
 *
 * @param {number} userId
 * @param {number} lockoutThreshold - failures before lockout (from config)
 * @returns {Promise<{counted:boolean, newCount:number|null, wasLocked:boolean}>}
 *          counted=false when the account was not ACTIVE (nothing changed);
 *          wasLocked=true only when THIS call caused the lockout.
 */
async function incrementFailedLogin(userId, lockoutThreshold) {
  const { rows } = await db.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         status = CASE
                    WHEN failed_login_attempts + 1 >= $2::int THEN 'LOCKED'::user_status_enum
                    ELSE status
                  END
     WHERE user_id = $1 AND status = 'ACTIVE'
     RETURNING failed_login_attempts, status`,
    [userId, lockoutThreshold]
  );
  const row = rows[0];
  if (!row) return { counted: false, newCount: null, wasLocked: false };
  return {
    counted:   true,
    newCount:  row.failed_login_attempts,
    wasLocked: row.status === 'LOCKED',
  };
}

/**
 * Administrator unlock: LOCKED → ACTIVE with the counter reset.
 * Never touches SUSPENDED, INACTIVE or PENDING accounts.
 *
 * @param {number} userId
 * @returns {Promise<{result:'UNLOCKED'|'NOT_FOUND'|'NOT_LOCKED', status?:string}>}
 */
async function unlockUser(userId) {
  const upd = await db.query(
    `UPDATE users
     SET status = 'ACTIVE', failed_login_attempts = 0
     WHERE user_id = $1 AND status = 'LOCKED'`,
    [userId]
  );
  if (upd.rowCount === 1) return { result: 'UNLOCKED' };

  const current = await findById(userId);
  if (!current) return { result: 'NOT_FOUND' };
  return { result: 'NOT_LOCKED', status: current.status };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store a new refresh token. Stores only the SHA-256 hex digest.
 * created_at / expires_at are computed by the database in UTC.
 *
 * @param {{userId:number, rawToken:string, ttlSeconds:number}} params
 * @param {import('pg').PoolClient} [client] - transaction client
 * @returns {Promise<number>} token_id
 */
async function insertRefreshToken({ userId, rawToken, ttlSeconds }, client) {
  const { rows } = await run(
    client,
    `INSERT INTO refresh_tokens (user_id, token_hash, created_at, expires_at)
     VALUES ($1, $2, ${UTC_NOW}, ${UTC_NOW} + make_interval(secs => $3::double precision))
     RETURNING token_id`,
    [userId, sha256hex(rawToken), ttlSeconds]
  );
  return rows[0].token_id;
}

/**
 * Look up a refresh token row by its raw value (no state filtering).
 * Read-only helper; rotation uses rotateRefreshToken() instead.
 *
 * @param {string} rawToken
 * @returns {Promise<object|null>}
 */
async function findActiveRefreshToken(rawToken) {
  const { rows } = await db.query(
    `SELECT rt.token_id, rt.user_id, rt.expires_at, rt.revoked_at, rt.replaced_by
     FROM refresh_tokens rt
     WHERE rt.token_hash = $1`,
    [sha256hex(rawToken)]
  );
  return rows[0] || null;
}

/**
 * Atomically validate, replace and revoke a refresh token.
 *
 * Inside ONE transaction:
 *   1. SELECT … FOR UPDATE the presented token's row (concurrent rotations of
 *      the same token queue here).
 *   2. Reject unknown / revoked / expired tokens, and tokens whose account is
 *      no longer ACTIVE.
 *   3. REUSE DETECTION: a token that was already rotated away
 *      (revoked_at set AND replaced_by set) is being replayed — the whole
 *      token family (every live refresh token of that user) is revoked and
 *      that revocation is committed. A token revoked by logout/password change
 *      (replaced_by NULL) is just rejected.
 *   4. Otherwise insert the successor and mark the old token revoked +
 *      replaced_by, both committed together or not at all.
 *
 * Returns an outcome object instead of throwing for the expected rejections so
 * the reuse-revocation commits.
 *
 * @param {{rawOldToken:string, rawNewToken:string, ttlSeconds:number}} p
 * @returns {Promise<
 *   {ok:true,  userId:number, role:string} |
 *   {ok:false, reason:'NOT_FOUND'|'REVOKED'|'REUSED'|'EXPIRED'|'INACTIVE', userId?:number}
 * >}
 */
async function rotateRefreshToken({ rawOldToken, rawNewToken, ttlSeconds }) {
  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT rt.token_id, rt.user_id, rt.revoked_at, rt.replaced_by,
              (rt.expires_at <= ${UTC_NOW}) AS expired,
              u.status, r.role_name
       FROM refresh_tokens rt
       JOIN users u ON u.user_id = rt.user_id
       JOIN roles r ON r.role_id = u.role_id
       WHERE rt.token_hash = $1
       FOR UPDATE OF rt`,
      [sha256hex(rawOldToken)]
    );
    const stored = rows[0];
    if (!stored) return { ok: false, reason: 'NOT_FOUND' };

    if (stored.revoked_at) {
      if (stored.replaced_by !== null) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = ${UTC_NOW}
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [stored.user_id]
        );
        return { ok: false, reason: 'REUSED', userId: stored.user_id };
      }
      return { ok: false, reason: 'REVOKED', userId: stored.user_id };
    }
    if (stored.expired) return { ok: false, reason: 'EXPIRED', userId: stored.user_id };
    if (stored.status !== 'ACTIVE') return { ok: false, reason: 'INACTIVE', userId: stored.user_id };

    const newTokenId = await insertRefreshToken(
      { userId: stored.user_id, rawToken: rawNewToken, ttlSeconds },
      client
    );
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = ${UTC_NOW}, replaced_by = $2
       WHERE token_id = $1`,
      [stored.token_id, newTokenId]
    );

    return { ok: true, userId: stored.user_id, role: stored.role_name };
  });
}

/**
 * Revoke all active refresh tokens for a user (used on logout).
 * @param {number} userId
 * @param {import('pg').PoolClient} [client]
 */
async function revokeAllUserRefreshTokens(userId, client) {
  await run(
    client,
    `UPDATE refresh_tokens
     SET revoked_at = ${UTC_NOW}
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate all unused reset tokens for a user, then insert a new one — in
 * one transaction. Only the SHA-256 of the token is stored.
 *
 * @param {{userId:number, rawToken:string, ttlSeconds:number}} params
 * @returns {Promise<number>} reset_id
 */
async function insertPasswordResetToken({ userId, rawToken, ttlSeconds }) {
  return db.withTransaction(async (client) => {
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = ${UTC_NOW}
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
    const { rows } = await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, created_at, expires_at)
       VALUES ($1, $2, ${UTC_NOW}, ${UTC_NOW} + make_interval(secs => $3::double precision))
       RETURNING reset_id`,
      [userId, sha256hex(rawToken), ttlSeconds]
    );
    return rows[0].reset_id;
  });
}

/** Thrown inside a transaction to force a rollback of a "soft" failure. */
class RollbackSignal extends Error {}

/**
 * Atomically consume a reset token AND change the password.
 *
 * One transaction:
 *   1. Conditional UPDATE … SET used_at WHERE hash matches AND used_at IS NULL
 *      AND expires_at > UTC now. Two concurrent requests with the same token
 *      serialise on the row lock; the loser re-evaluates the WHERE clause,
 *      finds used_at set, and matches 0 rows.
 *   2. Update the password only if the account is still ACTIVE.
 *   3. Revoke the user's refresh tokens and any other outstanding reset tokens.
 * If step 2 matches nothing, the whole transaction (including step 1) is rolled
 * back, so a token is never burned without the password changing — and the
 * password never changes without the token being consumed.
 *
 * @param {{rawToken:string, newPasswordHash:string}} p
 * @returns {Promise<number|null>} user_id on success, null if token invalid/expired/used
 */
async function resetPasswordWithToken({ rawToken, newPasswordHash }) {
  try {
    return await db.withTransaction(async (client) => {
      const claim = await client.query(
        `UPDATE password_reset_tokens
         SET used_at = ${UTC_NOW}
         WHERE token_hash = $1
           AND used_at IS NULL
           AND expires_at > ${UTC_NOW}
         RETURNING user_id`,
        [sha256hex(rawToken)]
      );
      if (claim.rowCount !== 1) throw new RollbackSignal('token not claimable');
      const userId = claim.rows[0].user_id;

      const upd = await client.query(
        `UPDATE users
         SET password_hash = $2, failed_login_attempts = 0
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId, newPasswordHash]
      );
      if (upd.rowCount !== 1) throw new RollbackSignal('account not active');

      await client.query(
        `UPDATE password_reset_tokens SET used_at = ${UTC_NOW}
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
      );
      await revokeAllUserRefreshTokens(userId, client);
      return userId;
    });
  } catch (err) {
    if (err instanceof RollbackSignal) return null;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password update (authenticated change)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace the password hash of an ACTIVE user and revoke all of their refresh
 * tokens, atomically.
 *
 * @param {number} userId
 * @param {string} newPasswordHash - bcrypt hash
 * @returns {Promise<boolean>} false if the account is missing or not ACTIVE
 */
async function changePasswordAndRevokeSessions(userId, newPasswordHash) {
  try {
    await db.withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE users
         SET password_hash = $2, failed_login_attempts = 0
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId, newPasswordHash]
      );
      if (upd.rowCount !== 1) throw new RollbackSignal('account not active');
      await revokeAllUserRefreshTokens(userId, client);
    });
    return true;
  } catch (err) {
    if (err instanceof RollbackSignal) return false;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether an ACTIVE user has a specific permission.
 * Uses the user_permissions VIEW defined in schema.sql.
 *
 * @param {number} userId
 * @param {string} permissionName - e.g. 'MANAGE_USERS'
 * @returns {Promise<boolean>}
 */
async function hasPermission(userId, permissionName) {
  const { rows } = await db.query(
    `SELECT 1 FROM user_permissions
     WHERE user_id = $1 AND permission_name = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [userId, permissionName]
  );
  return rows.length > 0;
}

module.exports = {
  normaliseEmail,
  sha256hex,
  findByEmail,
  findById,
  findPasswordRecord,
  createCustomer,
  recordSuccessfulLogin,
  incrementFailedLogin,
  unlockUser,
  insertRefreshToken,
  findActiveRefreshToken,
  rotateRefreshToken,
  revokeAllUserRefreshTokens,
  insertPasswordResetToken,
  resetPasswordWithToken,
  changePasswordAndRevokeSessions,
  hasPermission,
};
