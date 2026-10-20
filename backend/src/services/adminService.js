/**
 * adminService.js — Identity-management actions reserved for administrators.
 *
 * Scope is deliberately minimal: it only contains actions that belong to the
 * C1 Identity & Access module and that the existing schema supports.
 *
 *   unlockAccount — LOCKED → ACTIVE (clears the failed-login counter).
 *     The lockout this reverses is the security lockout applied after too many
 *     failed logins. SUSPENDED / INACTIVE / PENDING accounts are never changed
 *     here, and no role is ever assigned or changed by this module.
 *
 * Authorization is enforced by the route (authenticate + requirePermission
 * 'MANAGE_USERS', which seed.sql grants to ADMIN only); the actor id always
 * comes from the verified token, never from the request body.
 */
'use strict';

const repo  = require('./userRepository');
const audit = require('./auditService');

/**
 * @param {number} actorUserId  - the authenticated administrator (req.user.userId)
 * @param {number} targetUserId - the account to unlock
 * @param {{ipAddress?:string, deviceInfo?:string}} [requestMeta]
 * @throws {Error} code NOT_FOUND | USER_NOT_LOCKED
 */
async function unlockAccount(actorUserId, targetUserId, requestMeta = {}) {
  const outcome = await repo.unlockUser(targetUserId);

  const base = {
    userId:       String(actorUserId),
    action:       audit.ACTIONS.ACCOUNT_UNLOCKED,
    resourceType: 'USER',
    resourceId:   String(targetUserId),
    ipAddress:    requestMeta.ipAddress,
    deviceInfo:   requestMeta.deviceInfo,
  };

  if (outcome.result === 'UNLOCKED') {
    await audit.log({ ...base, result: 'SUCCESS', metadata: {} });
    return;
  }

  if (outcome.result === 'NOT_FOUND') {
    await audit.log({ ...base, result: 'FAILURE', metadata: { reason: 'user_not_found' } });
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }

  await audit.log({
    ...base,
    result:   'FAILURE',
    metadata: { reason: 'user_not_locked', status: outcome.status },
  });
  throw Object.assign(new Error('Only LOCKED accounts can be unlocked'), {
    code:   'USER_NOT_LOCKED',
    status: outcome.status,
  });
}

module.exports = { unlockAccount };
