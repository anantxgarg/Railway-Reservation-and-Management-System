/**
 * auth.js — Express router for /api/auth/*
 *
 * All auth routes are defined here. Middleware is applied per route to make
 * the security requirements explicit at the routing layer.
 */
'use strict';

const express     = require('express');
const controller  = require('../controllers/authController');
const validation  = require('../validation/authValidation');
const { authenticate }  = require('../middleware/authenticate');
const { authLimiter, refreshLimiter, resetLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Public endpoints (no authentication required) ──────────────────────────

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  validation.registerRules,
  validation.validate,
  controller.register
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  validation.loginRules,
  validation.validate,
  controller.login
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  refreshLimiter,
  validation.refreshRules,
  validation.validate,
  controller.refresh
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  validation.forgotPasswordRules,
  validation.validate,
  controller.forgotPassword
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  resetLimiter,
  validation.resetPasswordRules,
  validation.validate,
  controller.resetPassword
);

// ── Authenticated endpoints (Bearer token required) ────────────────────────

// GET /api/auth/me
router.get('/me', authenticate, controller.me);

// POST /api/auth/logout
router.post('/logout', authenticate, controller.logout);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authLimiter,
  authenticate,
  validation.changePasswordRules,
  validation.validate,
  controller.changePassword
);

module.exports = router;
