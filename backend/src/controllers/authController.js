/**
 * authController.js — HTTP request/response handlers for auth endpoints.
 *
 * Controllers are thin: they extract validated data from req, call the
 * appropriate authService function, and format the HTTP response.
 * No business logic lives here — it all lives in authService.js.
 *
 * Error-to-status-code mapping:
 *   VALIDATION_ERROR        → 400 (handled by validate() middleware before this)
 *   EMAIL_TAKEN             → 409
 *   INVALID_CREDENTIALS     → 401
 *   ACCOUNT_NOT_ACTIVE      → 403
 *   INVALID_REFRESH_TOKEN   → 401
 *   EXPIRED_REFRESH_TOKEN   → 401
 *   INVALID_RESET_TOKEN     → 400
 *   NOT_FOUND               → 404
 *   DATABASE_ERROR          → 500
 *   (default)               → 500
 *
 * Never expose stack traces, SQL errors or internal field names in prod.
 */
'use strict';

const authService = require('../services/authService');
const repo        = require('../services/userRepository');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract metadata from req for audit logging. */
function requestMeta(req) {
  return {
    ipAddress:  req.ip,
    deviceInfo: (req.headers['user-agent'] || '').slice(0, 500),
  };
}

/** Map a service-layer error code to an HTTP status code. */
function codeToStatus(code) {
  switch (code) {
    case 'EMAIL_TAKEN':          return 409;
    case 'INVALID_CREDENTIALS':  return 401;
    case 'ACCOUNT_NOT_ACTIVE':   return 403;
    case 'INVALID_REFRESH_TOKEN':
    case 'EXPIRED_REFRESH_TOKEN':return 401;
    case 'INVALID_RESET_TOKEN':  return 400;
    case 'NOT_FOUND':            return 404;
    default:                     return 500;
  }
}

/** Send a structured error response without leaking internals. */
function handleError(res, err) {
  const status  = codeToStatus(err.code);
  const isProd  = process.env.NODE_ENV === 'production';

  // Never expose 500-class internals in production
  if (status === 500) {
    // Log only the error code/name: full error objects from pg/mongo can echo
    // query parameters or connection details.
    console.error('[CONTROLLER] Unhandled error:', err.code || err.name);
    return res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }

  return res.status(status).json({
    error: { code: err.code, message: err.message },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────

async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;
    const result = await authService.register(
      { name, email, phone, password },
      requestMeta(req)
    );

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        userId: result.userId,
        name:   result.name,
        email:  result.email,
        role:   result.role,
        status: result.status,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password }, requestMeta(req));

    return res.status(200).json({
      message:      result.message,
      token:        result.accessToken,   // access token (short-lived JWT)
      refreshToken: result.refreshToken,  // refresh token (long-lived opaque)
      user:         result.user,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────

async function me(req, res) {
  try {
    // req.user.userId is set by authenticate() middleware
    const user = await repo.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return res.status(200).json({
      userId:      user.user_id,
      name:        user.name,
      email:       user.email,
      phone:       user.phone,
      role:        user.role_name,
      status:      user.status,
      createdAt:   user.created_at,
      lastLoginAt: user.last_login_at,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

async function logout(req, res) {
  try {
    await authService.logout(req.user.userId, requestMeta(req));
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshTokens(refreshToken, requestMeta(req));

    return res.status(200).json({
      token:        result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(
      req.user.userId,
      { currentPassword, newPassword },
      requestMeta(req)
    );
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email, requestMeta(req));

    const response = {
      message:
        'If that email address is registered, a password reset link has been sent.',
    };

    // Only present when DEV_EXPOSE_RESET_TOKEN=true (development/test only;
    // config/env.js refuses it elsewhere). Never present by default.
    if (result.devToken) {
      response.devToken = result.devToken;
      response.devNote  = 'DEV ONLY: devToken is returned because DEV_EXPOSE_RESET_TOKEN=true.';
    }

    return res.status(200).json(response);
  } catch (err) {
    return handleError(res, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword({ token, newPassword }, requestMeta(req));
    return res.status(200).json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  register,
  login,
  me,
  logout,
  refresh,
  changePassword,
  forgotPassword,
  resetPassword,
};
