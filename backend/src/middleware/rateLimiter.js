/**
 * rateLimiter.js — Express-rate-limit configuration for auth endpoints.
 *
 * Limits are per client IP (req.ip). Behind a reverse proxy, req.ip is only
 * the real client if TRUST_PROXY is configured for that exact topology
 * (see config/trustProxy.js and app.js); otherwise every client shares the
 * proxy's address.
 *
 * Three independent limiters (each with its own counter):
 *   authLimiter    — register, login, forgot-password, change-password (default 20 / 15 min)
 *   refreshLimiter — refresh (default 60 / 15 min; legitimate clients refresh often)
 *   resetLimiter   — reset-password (default 10 / 15 min; guesses a secret token)
 *
 * The limiters are ALWAYS active (including under NODE_ENV=test) so they are
 * covered by tests; test suites raise the limits via environment variables.
 * Responses use HTTP 429 and the standard RateLimit-* headers.
 */
'use strict';

const rateLimit = require('express-rate-limit');
const config    = require('../config/env');

function createLimiter(max) {
  return rateLimit({
    windowMs:        config.rateLimitWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      error: {
        code:    'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    },
  });
}

const authLimiter    = createLimiter(config.rateLimitMaxAuth);
const refreshLimiter = createLimiter(config.rateLimitMaxRefresh);
const resetLimiter   = createLimiter(config.rateLimitMaxReset);

module.exports = { authLimiter, refreshLimiter, resetLimiter };
