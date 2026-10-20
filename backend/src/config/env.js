/**
 * env.js — Environment-variable loader and validator.
 *
 * Called once at startup. Throws a clear error if a required secret is absent
 * so the server never silently starts with a broken or insecure configuration.
 */
'use strict';

require('dotenv').config();

const { parseTrustProxy } = require('./trustProxy');

/**
 * Read a required string variable. Throws if absent or blank.
 * @param {string} name
 * @returns {string}
 */
function required(name) {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(
      `[CONFIG] Required environment variable "${name}" is missing or empty. ` +
        'Copy .env.example to .env and fill in all required values.'
    );
  }
  return val.trim();
}

/**
 * Read an optional string variable with a default.
 * @param {string} name
 * @param {string} defaultValue
 * @returns {string}
 */
function optional(name, defaultValue) {
  const val = process.env[name];
  return val && val.trim() ? val.trim() : defaultValue;
}

/**
 * Read a required positive integer.
 * @param {string} name
 * @param {number} [fallback]
 * @returns {number}
 */
function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[CONFIG] Required integer variable "${name}" is missing.`);
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[CONFIG] "${name}" must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

/**
 * Read an optional boolean ("true"/"false"). Anything else throws.
 * @param {string} name
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function bool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === 'true')  return true;
  if (v === 'false') return false;
  throw new Error(`[CONFIG] "${name}" must be "true" or "false".`);
}

// ── Production safety ────────────────────────────────────────────────────────
const nodeEnv = optional('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';
const jwtSecret = required('JWT_SECRET');

if (jwtSecret.length < 32) {
  throw new Error('[CONFIG] JWT_SECRET must be at least 32 characters (64+ recommended).');
}
if (isProd && jwtSecret.length < 64) {
  throw new Error(
    '[CONFIG] JWT_SECRET must be at least 64 characters in production.'
  );
}

// Explicit, default-OFF development aid: return the raw password-reset token in
// the /forgot-password response (there is no e-mail delivery yet). It is
// refused everywhere except NODE_ENV=development|test, so a mis-set flag can
// never leak reset tokens from a production/staging deployment.
const devExposeResetToken = bool('DEV_EXPOSE_RESET_TOKEN', false);
if (devExposeResetToken && !['development', 'test'].includes(nodeEnv)) {
  throw new Error(
    '[CONFIG] DEV_EXPOSE_RESET_TOKEN may only be enabled when NODE_ENV is "development" or "test".'
  );
}
if (devExposeResetToken) {
  console.warn('[CONFIG] WARNING: DEV_EXPOSE_RESET_TOKEN is enabled — reset tokens are returned in API responses. Development only.');
}
if (
  jwtSecret === 'REPLACE_WITH_A_STRONG_RANDOM_SECRET_AT_LEAST_64_CHARS' ||
  jwtSecret.startsWith('REPLACE_')
) {
  if (isProd) {
    throw new Error('[CONFIG] JWT_SECRET still contains the placeholder value. Set a real secret.');
  } else {
    console.warn('[CONFIG] WARNING: JWT_SECRET is still the placeholder. Set a real value before deploying.');
  }
}

const config = {
  nodeEnv,
  isProd,
  port: positiveInt('PORT', 3000),

  // PostgreSQL — passed to pg.Pool as an object
  pg: {
    host:     required('PGHOST'),
    port:     positiveInt('PGPORT', 5432),
    database: required('PGDATABASE'),
    user:     required('PGUSER'),
    password: required('PGPASSWORD'),
    // Sensible pool limits for a college project
    max: positiveInt('PG_POOL_MAX', 10),
    idleTimeoutMillis:    30_000,
    connectionTimeoutMillis: 5_000,
  },

  // MongoDB
  mongoUri: required('MONGO_URI'),

  // JWT
  jwtSecret,
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '15m'),

  // Refresh token
  refreshTokenExpiresDays: positiveInt('REFRESH_TOKEN_EXPIRES_DAYS', 7),

  // Password reset token
  resetTokenExpiresMinutes: positiveInt('RESET_TOKEN_EXPIRES_MINUTES', 60),
  devExposeResetToken,

  // Account lockout
  loginLockoutThreshold: positiveInt('LOGIN_LOCKOUT_THRESHOLD', 5),

  // CORS & Frontend
  corsOrigin:  optional('CORS_ORIGIN', 'http://localhost:5173'),
  frontendUrl: optional('FRONTEND_URL', optional('CORS_ORIGIN', 'http://localhost:5173')),

  // Email (Brevo Transactional API)
  email: {
    brevoApiKey: optional('BREVO_API_KEY', ''),
    from:        optional('EMAIL_FROM', 'noreply@railway.local'),
  },

  // Reverse-proxy trust (false by default; see config/trustProxy.js)
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  // Rate limiting (per client IP, per window)
  rateLimitWindowMs:  positiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMaxAuth:   positiveInt('RATE_LIMIT_MAX_AUTH',    20), // register, login, forgot-password, change-password
  rateLimitMaxRefresh: positiveInt('RATE_LIMIT_MAX_REFRESH', 60), // refresh
  rateLimitMaxReset:  positiveInt('RATE_LIMIT_MAX_RESET',   10), // reset-password
};

module.exports = config;
