/**
 * admin.js — Express router for /api/admin/*  (identity management).
 *
 * Every route here requires a verified token AND a database-granted permission.
 * 401 = not authenticated, 403 = authenticated without MANAGE_USERS.
 */
'use strict';

const express    = require('express');
const controller = require('../controllers/adminController');
const validation = require('../validation/authValidation');
const { authenticate }      = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');

const router = express.Router();

// POST /api/admin/users/:userId/unlock
// Authorization runs BEFORE param validation so unauthorised callers learn nothing.
router.post(
  '/users/:userId/unlock',
  authenticate,
  requirePermission('MANAGE_USERS'),
  validation.userIdParamRules,
  validation.validate,
  controller.unlockUser
);

module.exports = router;
