/**
 * adminController.js / userController — handlers for the real routes that
 * demonstrate the authorization middleware.
 *
 *   POST /api/admin/users/:userId/unlock   (authenticate + MANAGE_USERS)
 *   GET  /api/users/:userId                (authenticate + owner-or-ADMIN)
 */
'use strict';

const adminService = require('../services/adminService');
const repo         = require('../services/userRepository');

function requestMeta(req) {
  return {
    ipAddress:  req.ip,
    deviceInfo: (req.headers['user-agent'] || '').slice(0, 500),
  };
}

function sendError(res, err) {
  switch (err.code) {
    case 'NOT_FOUND':
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    case 'USER_NOT_LOCKED':
      return res.status(409).json({ error: { code: 'USER_NOT_LOCKED', message: err.message } });
    default:
      console.error('[ADMIN CONTROLLER] Unhandled error:', err.code || err.name);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
}

/** POST /api/admin/users/:userId/unlock */
async function unlockUser(req, res) {
  try {
    const targetId = parseInt(req.params.userId, 10);
    await adminService.unlockAccount(req.user.userId, targetId, requestMeta(req));
    return res.status(200).json({ message: 'Account unlocked', userId: targetId });
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /api/users/:userId — profile of the owner (or any user, for ADMIN). */
async function getUser(req, res) {
  try {
    const user = await repo.findById(parseInt(req.params.userId, 10));
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
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
    return sendError(res, err);
  }
}

module.exports = { unlockUser, getUser };
