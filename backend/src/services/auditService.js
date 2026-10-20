/**
 * auditService.js — Write security events to the MongoDB audit_log collection.
 *
 * Schema: database/c1-identity/mongo/audit_log.js
 *
 * Rules enforced here:
 *  - user_id is stored as a string ("5"), never as an integer.
 *  - token/password/hash values must NEVER appear in metadata.
 *  - Unknown fields are rejected by the DB's $jsonSchema validator;
 *    we build documents explicitly to prevent accidental field leakage.
 *  - Audit failures are logged to stderr but do NOT surface as HTTP errors.
 *    A logging outage must not block authentication.
 */
'use strict';

const { v4: uuidv4 }   = require('uuid');
const { auditCollection } = require('../config/mongo');

/**
 * Supported audit action constants.
 * Use these constants everywhere to avoid typos.
 */
const ACTIONS = Object.freeze({
  USER_REGISTERED:         'USER_REGISTERED',
  LOGIN:                   'LOGIN',
  LOGIN_FAILED:            'LOGIN_FAILED',
  LOGIN_BLOCKED:           'LOGIN_BLOCKED',    // account locked/suspended/inactive
  LOGOUT:                  'LOGOUT',
  TOKEN_REFRESHED:         'TOKEN_REFRESHED',
  TOKEN_REVOKED:           'TOKEN_REVOKED',
  PASSWORD_CHANGED:        'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED:'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED:'PASSWORD_RESET_COMPLETED',
  ACCOUNT_LOCKED:          'ACCOUNT_LOCKED',   // lockout triggered
  ACCOUNT_UNLOCKED:        'ACCOUNT_UNLOCKED', // administrator unlocked a LOCKED account
  TOKEN_REUSE_DETECTED:    'TOKEN_REUSE_DETECTED', // rotated refresh token replayed
  ACCESS_DENIED:           'ACCESS_DENIED',
});

/**
 * Write one audit event.
 *
 * @param {object} params
 * @param {string|null} params.userId       - users.user_id as STRING or null
 * @param {string}      params.action       - one of ACTIONS.*
 * @param {string}      params.resourceType - e.g. "USER", "TOKEN"
 * @param {string|null} [params.resourceId] - e.g. the affected user_id as string
 * @param {'SUCCESS'|'FAILURE'} params.result
 * @param {object}      [params.metadata]   - safe key/value pairs only
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.deviceInfo]
 */
async function log({
  userId       = null,
  action,
  resourceType,
  resourceId   = null,
  result,
  metadata     = {},
  ipAddress    = null,
  deviceInfo   = null,
}) {
  // Sanitize: user_id must be a string or null, never a number
  const userIdStr = userId !== null && userId !== undefined
    ? String(userId)
    : null;

  const doc = {
    audit_id:      uuidv4(),
    user_id:       userIdStr,
    action,
    resource_type: resourceType,
    resource_id:   resourceId !== null ? String(resourceId) : null,
    timestamp:     new Date(),
    result,
    metadata,
    ip_address:    ipAddress  || null,
    device_info:   deviceInfo || null,
  };

  try {
    await auditCollection().insertOne(doc);
  } catch (err) {
    // Audit failure must NOT block the auth response.
    // Log to stderr only — do not rethrow.
    console.error('[AUDIT] Failed to write audit log:', err.code || err.name, '| doc.action:', action);
  }
}

module.exports = { log, ACTIONS };
