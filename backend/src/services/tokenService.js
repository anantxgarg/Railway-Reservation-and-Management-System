/**
 * tokenService.js — JWT and refresh-token lifecycle management.
 *
 * Design:
 *   - Access tokens: short-lived signed JWT (default 15 min).
 *     They are STATELESS — the server cannot revoke them individually.
 *     (authenticate() does re-check the account status in the database on
 *     every request, so a suspended/locked/deleted account is refused
 *     immediately even though its JWT is still unexpired.)
 *   - Refresh tokens: long-lived opaque random bytes stored as SHA-256
 *     in the refresh_tokens table. Revocable on logout. Rotated on use, with
 *     reuse detection (see userRepository.rotateRefreshToken).
 *
 * Security rules:
 *   - Never put passwords, hashes, or raw tokens in JWT payload.
 *   - Algorithm is HS256 ONLY (symmetric HMAC-SHA-256 with a shared secret).
 *     There is no RS256 and no algorithm fallback. The algorithm is pinned in
 *     BOTH jwt.sign and jwt.verify, so tokens signed with "none" or with any
 *     other algorithm are rejected.
 *   - The signing secret is read from config, never hard-coded.
 *   - Tokens are verified for signature, algorithm, expiry, issuer and audience.
 */
'use strict';

const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const config  = require('../config/env');
const repo    = require('./userRepository');

const ALGORITHM = 'HS256';
const ISSUER    = 'railway-api';
const AUDIENCE  = 'railway-client';

// ─────────────────────────────────────────────────────────────────────────────
// Access tokens (JWT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a signed JWT for an authenticated user.
 * Payload contains only user_id and role — never PII or passwords.
 *
 * @param {{userId:number, role:string}} identity
 * @returns {string} signed JWT
 */
function generateAccessToken({ userId, role }) {
  return jwt.sign(
    { sub: String(userId), role },
    config.jwtSecret,
    {
      algorithm: ALGORITHM,
      expiresIn: config.jwtExpiresIn,
      issuer:    ISSUER,
      audience:  AUDIENCE,
    }
  );
}

/**
 * Verify and decode a JWT.
 * Throws a JsonWebTokenError / TokenExpiredError on failure.
 *
 * @param {string} token
 * @returns {{ sub: string, role: string, iat: number, exp: number }}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITHM],
    issuer:     ISSUER,
    audience:   AUDIENCE,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh tokens (opaque, stored as SHA-256 in DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random refresh token (64 bytes = 128 hex chars).
 * The DB stores sha256(rawToken) — 64 hex chars; the raw value is returned
 * to the caller to send to the client.
 *
 * @returns {string} raw refresh token (hex string)
 */
function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/** Refresh-token lifetime in seconds. */
function refreshTtlSeconds() {
  return config.refreshTokenExpiresDays * 24 * 60 * 60;
}

/**
 * Issue a new refresh token: generate, store SHA-256 in DB, return raw.
 *
 * @param {number} userId
 * @returns {Promise<string>} raw refresh token for the HTTP response
 */
async function issueRefreshToken(userId) {
  const raw = generateRawRefreshToken();
  await repo.insertRefreshToken({ userId, rawToken: raw, ttlSeconds: refreshTtlSeconds() });
  return raw;
}

const REJECTION = {
  NOT_FOUND: { code: 'INVALID_REFRESH_TOKEN',  message: 'Refresh token is invalid' },
  REVOKED:   { code: 'INVALID_REFRESH_TOKEN',  message: 'Refresh token is invalid' },
  REUSED:    { code: 'INVALID_REFRESH_TOKEN',  message: 'Refresh token is invalid' },
  EXPIRED:   { code: 'EXPIRED_REFRESH_TOKEN',  message: 'Refresh token has expired' },
  INACTIVE:  { code: 'ACCOUNT_NOT_ACTIVE',     message: 'Account is not active' },
};

/**
 * Rotate a refresh token atomically: validate, issue a successor and revoke
 * the old token in a single database transaction (see
 * userRepository.rotateRefreshToken). A given refresh token can be rotated
 * successfully at most once, even under concurrent requests.
 *
 * The client-visible error is deliberately the same for unknown, revoked and
 * replayed tokens; replay is flagged on the error (`reuseDetected`) for the
 * audit log only.
 *
 * @param {string} rawOldToken - the token presented by the client
 * @returns {Promise<{accessToken:string, refreshToken:string, userId:number, role:string}>}
 * @throws {Error} code INVALID_REFRESH_TOKEN | EXPIRED_REFRESH_TOKEN | ACCOUNT_NOT_ACTIVE
 */
async function rotateRefreshToken(rawOldToken) {
  const rawNewToken = generateRawRefreshToken();
  const outcome = await repo.rotateRefreshToken({
    rawOldToken,
    rawNewToken,
    ttlSeconds: refreshTtlSeconds(),
  });

  if (!outcome.ok) {
    const { code, message } = REJECTION[outcome.reason];
    throw Object.assign(new Error(message), {
      code,
      reuseDetected: outcome.reason === 'REUSED',
      userId:        outcome.userId,
    });
  }

  return {
    accessToken:  generateAccessToken({ userId: outcome.userId, role: outcome.role }),
    refreshToken: rawNewToken,
    userId:       outcome.userId,
    role:         outcome.role,
  };
}

module.exports = {
  ALGORITHM,
  generateAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
};
