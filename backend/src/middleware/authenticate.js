/**
 * authenticate.js — Authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header, verifies it,
 * loads the user's current status from the database, and attaches a trusted
 * identity object to req.user.
 *
 * Interface attached to req.user:
 *   {
 *     userId: number,   // users.user_id (integer)
 *     role:   string,   // e.g. 'CUSTOMER', 'STAFF', 'ADMIN'
 *   }
 *
 * Other backend modules (booking, payment, etc.) should import and use
 * this middleware rather than implementing their own login checks.
 * They can access req.user.userId and req.user.role.
 *
 * Returns 401 for any unauthenticated or invalid request.
 * Never trusts a user-supplied userId or role from the request body/query.
 */
'use strict';

const { verifyAccessToken } = require('../services/tokenService');
const repo                  = require('../services/userRepository');

/**
 * Strict authentication: token required, signature verified, account ACTIVE.
 *
 * @type {import('express').RequestHandler}
 */
async function authenticate(req, res, next) {
  try {
    // 1. Extract the Bearer token
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'MISSING_TOKEN', message: 'Authentication required' },
      });
    }
    const token = authHeader.slice(7); // strip "Bearer "

    // 2. Verify signature, expiry, issuer, audience
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        error: {
          code:    isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: isExpired ? 'Access token has expired' : 'Invalid access token',
        },
      });
    }

    // 3. payload.sub is the userId as a string — convert to integer
    const userId = parseInt(payload.sub, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid token payload' },
      });
    }

    // 4. Verify the account still exists and is ACTIVE
    //    (role may have changed since the token was issued — we re-read it)
    const user = await repo.findById(userId);
    if (!user) {
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'Authentication required' },
      });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        error: {
          code:    'ACCOUNT_NOT_ACTIVE',
          message: 'Account is not active',
        },
      });
    }

    // 5. Attach trusted identity — downstream code MUST use this, not the token payload
    req.user = {
      userId:   user.user_id,
      role:     user.role_name,   // freshly loaded from DB, not from token
    };

    return next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE] Unexpected error:', err.code || err.name);
    return res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
}

module.exports = { authenticate };
