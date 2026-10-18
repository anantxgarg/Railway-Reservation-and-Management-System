/**
 * authService.js — Business logic for authentication operations.
 *
 * Coordinates userRepository, tokenService, and auditService.
 * Controllers call this layer; it never interacts with HTTP req/res.
 *
 * Password hashing: bcryptjs (compatible with $2b$ hashes from the seed).
 *   The DB enforces bcrypt format via CHECK constraint as a last-resort guard.
 *
 * Lockout policy:
 *   After LOGIN_LOCKOUT_THRESHOLD consecutive failures on a known account,
 *   status is set to 'LOCKED'. Lockout is permanent until an admin resets it
 *   (the schema has no "locked_until" column — open decision #4 in README).
 */
'use strict';

const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const config       = require('../config/env');
const repo         = require('./userRepository');
const tokenService = require('./tokenService');
const audit        = require('./auditService');
const emailService = require('./emailService');

const BCRYPT_ROUNDS = 12; // matches seed_dev_users.sql cost

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a new customer.
 * - Validates business rules (duplicate email, etc.)
 * - Hashes password before storage
 * - Assigns CUSTOMER role (never STAFF or ADMIN)
 * - Logs the event to audit_log
 *
 * @param {{name:string, email:string, phone?:string, password:string}} input
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 * @returns {Promise<{userId:number, name:string, email:string, role:'CUSTOMER', status:string}>}
 * @throws {Error} with .code = 'EMAIL_TAKEN' | 'DATABASE_ERROR'
 */
async function register(input, requestMeta = {}) {
  const { name, email, phone, password } = input;
  const normalEmail = repo.normaliseEmail(email);

  // Check for duplicate email (the DB also enforces this, but we want a
  // clean error code rather than a PG constraint error reaching the client)
  const existing = await repo.findByEmail(normalEmail);
  if (existing) {
    // Use a timing-safe delay to avoid email-enumeration via timing
    await bcrypt.hash(password, BCRYPT_ROUNDS); // consume same time as normal
    await audit.log({
      userId:       null,
      action:       audit.ACTIONS.USER_REGISTERED,
      resourceType: 'USER',
      result:       'FAILURE',
      metadata:     { reason: 'email_already_registered' },
      ipAddress:    requestMeta.ipAddress,
      deviceInfo:   requestMeta.deviceInfo,
    });
    throw Object.assign(new Error('Email address is already registered'), {
      code: 'EMAIL_TAKEN',
    });
  }

  // Hash the password — the schema's CHECK constraint also rejects non-bcrypt hashes
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let created;
  try {
    created = await repo.createCustomer({ name, email: normalEmail, phone, passwordHash });
  } catch (err) {
    // Catch DB-level unique-constraint race (concurrent registration)
    if (err.code === '23505') {
      throw Object.assign(new Error('Email address is already registered'), {
        code: 'EMAIL_TAKEN',
      });
    }
    throw Object.assign(new Error('Failed to create account'), {
      code: 'DATABASE_ERROR',
      cause: err,
    });
  }

  await audit.log({
    userId:       String(created.user_id),
    action:       audit.ACTIONS.USER_REGISTERED,
    resourceType: 'USER',
    resourceId:   String(created.user_id),
    result:       'SUCCESS',
    metadata:     { role: 'CUSTOMER' },
    ipAddress:    requestMeta.ipAddress,
    deviceInfo:   requestMeta.deviceInfo,
  });

  return {
    userId: created.user_id,
    name:   created.name,
    email:  created.email,
    role:   'CUSTOMER',
    status: created.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user and return tokens.
 *
 * Follows the schema contract:
 *   - Only ACTIVE accounts may log in.
 *   - Increments failed_login_attempts on failure; locks account at threshold.
 *   - Resets counter and sets last_login_at on success.
 *   - Returns a generic error for wrong credentials (no username-enumeration).
 *
 * @param {{email:string, password:string}} input
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 * @returns {Promise<{message:string, accessToken:string, refreshToken:string, user:object}>}
 */
async function login(input, requestMeta = {}) {
  const { email, password } = input;
  const normalEmail = repo.normaliseEmail(email);

  const user = await repo.findByEmail(normalEmail);

  // Always run bcrypt even when user not found — prevents timing-based enumeration.
  const DUMMY_HASH = '$2b$12$IrZjxD4X72slxHVXvpLfv.VuqN4nfCBIVNpsVS2bcxHLO9iFD/DaG';
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordMatch) {
    // Log failure against known user if found, null otherwise
    if (user) {
      // Only ACTIVE accounts are counted / locked. An administrator-imposed
      // SUSPENDED or INACTIVE status is never overwritten by failed attempts.
      const { wasLocked } = await repo.incrementFailedLogin(
        user.user_id,
        config.loginLockoutThreshold
      );

      await audit.log({
        userId:       String(user.user_id),
        action:       wasLocked ? audit.ACTIONS.ACCOUNT_LOCKED : audit.ACTIONS.LOGIN_FAILED,
        resourceType: 'USER',
        resourceId:   String(user.user_id),
        result:       'FAILURE',
        metadata:     { reason: 'invalid_password', wasLocked },
        ipAddress:    requestMeta.ipAddress,
        deviceInfo:   requestMeta.deviceInfo,
      });
    } else {
      await audit.log({
        userId:       null,
        action:       audit.ACTIONS.LOGIN_FAILED,
        resourceType: 'USER',
        result:       'FAILURE',
        metadata:     { reason: 'unknown_email' },
        ipAddress:    requestMeta.ipAddress,
        deviceInfo:   requestMeta.deviceInfo,
      });
    }

    throw Object.assign(new Error('Invalid email or password'), {
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Reject non-ACTIVE accounts with a distinct audit event but the same HTTP error
  if (user.status !== 'ACTIVE') {
    await audit.log({
      userId:       String(user.user_id),
      action:       audit.ACTIONS.LOGIN_BLOCKED,
      resourceType: 'USER',
      resourceId:   String(user.user_id),
      result:       'FAILURE',
      metadata:     { status: user.status },
      ipAddress:    requestMeta.ipAddress,
      deviceInfo:   requestMeta.deviceInfo,
    });

    // Map status to a user-facing message
    const statusMessages = {
      LOCKED:    'Your account has been locked due to multiple failed login attempts. Contact support.',
      SUSPENDED: 'Your account has been suspended. Contact support.',
      INACTIVE:  'Your account is inactive. Contact support.',
      PENDING:   'Your account is pending verification. Please verify your email.',
    };
    const message = statusMessages[user.status] || 'Your account cannot log in.';
    throw Object.assign(new Error(message), {
      code:   'ACCOUNT_NOT_ACTIVE',
      status: user.status,
    });
  }

  // Success — update login metadata. The UPDATE only matches ACTIVE accounts,
  // so it is also a last-moment status check (e.g. suspended between the read
  // above and now); no token is issued if it fails.
  const recorded = await repo.recordSuccessfulLogin(user.user_id);
  if (!recorded) {
    throw Object.assign(new Error('Your account cannot log in.'), {
      code:   'ACCOUNT_NOT_ACTIVE',
      status: 'UNKNOWN',
    });
  }

  // Issue tokens
  const accessToken  = tokenService.generateAccessToken({ userId: user.user_id, role: user.role_name });
  const refreshToken = await tokenService.issueRefreshToken(user.user_id);

  await audit.log({
    userId:       String(user.user_id),
    action:       audit.ACTIONS.LOGIN,
    resourceType: 'USER',
    resourceId:   String(user.user_id),
    result:       'SUCCESS',
    metadata:     { role: user.role_name },
    ipAddress:    requestMeta.ipAddress,
    deviceInfo:   requestMeta.deviceInfo,
  });

  return {
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      name:   user.name,
      email:  user.email,
      role:   user.role_name,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revoke all refresh tokens for the authenticated user.
 * Access tokens remain valid until expiry (they are stateless JWTs).
 * Clients MUST discard the access token on logout.
 *
 * @param {number} userId
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 */
async function logout(userId, requestMeta = {}) {
  await repo.revokeAllUserRefreshTokens(userId);

  await audit.log({
    userId:       String(userId),
    action:       audit.ACTIONS.LOGOUT,
    resourceType: 'USER',
    resourceId:   String(userId),
    result:       'SUCCESS',
    metadata:     {},
    ipAddress:    requestMeta.ipAddress,
    deviceInfo:   requestMeta.deviceInfo,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Token refresh
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exchange a valid refresh token for a new access + refresh token pair.
 * Uses rotation: the old refresh token is revoked; a new one is issued.
 *
 * @param {string} rawRefreshToken
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 */
async function refreshTokens(rawRefreshToken, requestMeta = {}) {
  let result;
  try {
    result = await tokenService.rotateRefreshToken(rawRefreshToken);
  } catch (err) {
    if (err.reuseDetected) {
      // A rotated-away token was replayed: the whole token family was revoked.
      await audit.log({
        userId:       String(err.userId),
        action:       audit.ACTIONS.TOKEN_REUSE_DETECTED,
        resourceType: 'TOKEN',
        resourceId:   String(err.userId),
        result:       'FAILURE',
        metadata:     { response: 'all_refresh_tokens_revoked' },
        ipAddress:    requestMeta.ipAddress,
        deviceInfo:   requestMeta.deviceInfo,
      });
    }
    throw err;
  }

  await audit.log({
    userId:       String(result.userId),
    action:       audit.ACTIONS.TOKEN_REFRESHED,
    resourceType: 'USER',
    resourceId:   String(result.userId),
    result:       'SUCCESS',
    metadata:     {},
    ipAddress:    requestMeta.ipAddress,
    deviceInfo:   requestMeta.deviceInfo,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Change password (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Change password for an already-authenticated user.
 * Verifies the current password before accepting the new one.
 *
 * @param {number} userId
 * @param {{currentPassword:string, newPassword:string}} input
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 */
async function changePassword(userId, input, requestMeta = {}) {
  const { currentPassword, newPassword } = input;

  const user = await repo.findPasswordRecord(userId);

  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }
  if (user.status !== 'ACTIVE') {
    throw Object.assign(new Error('Account is not active'), { code: 'ACCOUNT_NOT_ACTIVE' });
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    await audit.log({
      userId:       String(userId),
      action:       audit.ACTIONS.PASSWORD_CHANGED,
      resourceType: 'USER',
      resourceId:   String(userId),
      result:       'FAILURE',
      metadata:     { reason: 'wrong_current_password' },
      ipAddress:    requestMeta.ipAddress,
    });
    throw Object.assign(new Error('Current password is incorrect'), {
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Password update + revocation of every refresh token (re-login on all
  // devices) commit together or not at all.
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const changed = await repo.changePasswordAndRevokeSessions(userId, newHash);
  if (!changed) {
    throw Object.assign(new Error('Account is not active'), { code: 'ACCOUNT_NOT_ACTIVE' });
  }

  await audit.log({
    userId:       String(userId),
    action:       audit.ACTIONS.PASSWORD_CHANGED,
    resourceType: 'USER',
    resourceId:   String(userId),
    result:       'SUCCESS',
    metadata:     {},
    ipAddress:    requestMeta.ipAddress,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Forgot / reset password (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request a password reset.
 *
 * The caller's response is identical whether or not the e-mail is registered
 * (and whether or not the account is eligible), so account existence is not
 * revealed through this endpoint's body or status. The reset token is a
 * 256-bit CSPRNG value; only its SHA-256 is stored.
 *
 * There is no e-mail delivery yet. The raw token is therefore NEVER logged and
 * NEVER returned — except when the operator has explicitly set
 * DEV_EXPOSE_RESET_TOKEN=true, which env.js refuses outside NODE_ENV
 * development/test. The default is off.
 *
 * Remaining timing difference: a registered account performs two extra
 * database writes. This is documented in docs/API.md as residual risk.
 *
 * @param {string} email
 * @param {{ipAddress?:string}} [requestMeta]
 * @returns {Promise<{devToken?:string}>}
 */
async function requestPasswordReset(email, requestMeta = {}) {
  const normalEmail = repo.normaliseEmail(email);
  const user        = await repo.findByEmail(normalEmail);

  if (!user || user.status !== 'ACTIVE') {
    await audit.log({
      userId:       user ? String(user.user_id) : null,
      action:       audit.ACTIONS.PASSWORD_RESET_REQUESTED,
      resourceType: 'USER',
      resourceId:   user ? String(user.user_id) : null,
      result:       'FAILURE',
      metadata:     { reason: user ? 'account_not_active' : 'unknown_email' },
      ipAddress:    requestMeta.ipAddress,
    });
    return {};
  }

  const rawToken = crypto.randomBytes(32).toString('hex'); // 64 hex chars

  await repo.insertPasswordResetToken({
    userId:     user.user_id,
    rawToken,
    ttlSeconds: config.resetTokenExpiresMinutes * 60,
  });

  await audit.log({
    userId:       String(user.user_id),
    action:       audit.ACTIONS.PASSWORD_RESET_REQUESTED,
    resourceType: 'USER',
    resourceId:   String(user.user_id),
    result:       'SUCCESS',
    metadata:     {},
    ipAddress:    requestMeta.ipAddress,
  });

  try {
    await emailService.sendPasswordResetEmail({
      to: normalEmail,
      rawToken,
    });
  } catch {
    // Delivery failure is swallowed to preserve generic response & prevent account enumeration
  }

  if (config.devExposeResetToken) {
    return { devToken: rawToken };
  }

  return {};
}

/**
 * Complete a password reset using the token from the email link.
 * Token consumption and the password update are one atomic database
 * transaction (userRepository.resetPasswordWithToken).
 *
 * @param {{token:string, newPassword:string}} input
 * @param {{ipAddress?:string}} [requestMeta]
 */
async function resetPassword(input, requestMeta = {}) {
  const { token, newPassword } = input;

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const userId  = await repo.resetPasswordWithToken({ rawToken: token, newPasswordHash: newHash });

  if (userId === null) {
    await audit.log({
      userId:       null,
      action:       audit.ACTIONS.PASSWORD_RESET_COMPLETED,
      resourceType: 'USER',
      result:       'FAILURE',
      metadata:     { reason: 'invalid_expired_or_used_token' },
      ipAddress:    requestMeta.ipAddress,
    });
    throw Object.assign(new Error('Password reset token is invalid or has expired'), {
      code: 'INVALID_RESET_TOKEN',
    });
  }

  await audit.log({
    userId:       String(userId),
    action:       audit.ACTIONS.PASSWORD_RESET_COMPLETED,
    resourceType: 'USER',
    resourceId:   String(userId),
    result:       'SUCCESS',
    metadata:     {},
    ipAddress:    requestMeta.ipAddress,
  });
}

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  changePassword,
  requestPasswordReset,
  resetPassword,
};
