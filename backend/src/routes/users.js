/**
 * users.js — Express router for /api/users/*
 *
 * GET /api/users/:userId — a user may read their own profile; ADMIN may read any.
 * Enforced server-side by requireOwnership against the VERIFIED identity.
 */
'use strict';

const express    = require('express');
const controller = require('../controllers/adminController');
const validation = require('../validation/authValidation');
const { authenticate }      = require('../middleware/authenticate');
const { requireOwnership }  = require('../middleware/authorize');

const router = express.Router();

router.get(
  '/:userId',
  authenticate,
  requireOwnership('userId'),
  validation.userIdParamRules,
  validation.validate,
  controller.getUser
);

module.exports = router;
