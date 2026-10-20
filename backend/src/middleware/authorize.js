/**
 * authorize.js — Role and permission authorization middleware factories.
 *
 * Usage examples:
 *
 *   // Require a specific role
 *   router.delete('/users/:id', authenticate, requireRole('ADMIN'), handler);
 *
 *   // Require a specific permission (checks DB via user_permissions VIEW)
 *   router.get('/audit', authenticate, requirePermission('VIEW_AUDIT_LOG'), handler);
 *
 *   // Require ownership (user_id in route param matches authenticated user)
 *   router.get('/bookings/:userId', authenticate, requireOwnership('userId'), handler);
 *
 * Rules:
 *   - 401 if no authenticated user on req.user (should not reach here if
 *     authenticate() runs first, but guarded defensively).
 *   - 403 if authenticated but insufficient role/permission.
 *   - Permission data is loaded from the database (user_permissions VIEW),
 *     not from the JWT payload, so changes take effect immediately.
 */
'use strict';

const repo  = require('../services/userRepository');
const audit = require('../services/auditService');

// ─────────────────────────────────────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory: allow only the specified role(s).
 * Roles are UPPER_SNAKE_CASE strings: 'CUSTOMER', 'STAFF', 'ADMIN'.
 *
 * @param {...string} roles
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    if (!roles.includes(req.user.role)) {
      await audit.log({
        userId:       String(req.user.userId),
        action:       audit.ACTIONS.ACCESS_DENIED,
        resourceType: 'ENDPOINT',
        resourceId:   req.path,
        result:       'FAILURE',
        metadata:     { required_role: roles, actual_role: req.user.role },
        ipAddress:    req.ip,
      });

      return res.status(403).json({
        error: {
          code:    'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    }

    return next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requirePermission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory: allow only users whose role grants the given permission.
 * Checks the user_permissions VIEW in the database.
 *
 * @param {string} permissionName - e.g. 'MANAGE_USERS'
 * @returns {import('express').RequestHandler}
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    try {
      const allowed = await repo.hasPermission(req.user.userId, permissionName);
      if (!allowed) {
        await audit.log({
          userId:       String(req.user.userId),
          action:       audit.ACTIONS.ACCESS_DENIED,
          resourceType: 'ENDPOINT',
          resourceId:   req.path,
          result:       'FAILURE',
          metadata:     { required_permission: permissionName, role: req.user.role },
          ipAddress:    req.ip,
        });

        return res.status(403).json({
          error: {
            code:    'FORBIDDEN',
            message: 'You do not have permission to perform this action',
          },
        });
      }

      return next();
    } catch (err) {
      console.error('[AUTHORIZE] Permission check failed:', err.code || err.name);
      return res.status(500).json({
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnership
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory: allow only if req.params[paramName] === req.user.userId,
 * OR if the user is ADMIN (admins can always access any user's resources).
 *
 * Use for endpoints like GET /users/:userId/bookings where a CUSTOMER
 * should only see their own data.
 *
 * @param {string} [paramName='userId'] - the route parameter that holds the user_id
 * @returns {import('express').RequestHandler}
 */
function requireOwnership(paramName = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const resourceUserId = parseInt(req.params[paramName], 10);

    if (req.user.role === 'ADMIN' || req.user.userId === resourceUserId) {
      return next();
    }

    return res.status(403).json({
      error: {
        code:    'FORBIDDEN',
        message: 'You can only access your own resources',
      },
    });
  };
}

module.exports = { requireRole, requirePermission, requireOwnership };
