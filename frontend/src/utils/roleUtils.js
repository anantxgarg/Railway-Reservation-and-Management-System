/**
 * Role-Based Access Control (RBAC) helpers
 * Aligned with Team 1 Identity & Access contract (docs/API.md)
 */

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
};

/**
 * Returns the first screen of the logged-in app for a given role
 * @param {string} role - CUSTOMER, STAFF, or ADMIN
 * @returns {string} - Destination route path
 */
export function getRoleDestination(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/admin';
    default:
      // customers book; staff look up PNRs and review concessions from the same screens
      return '/search';
  }
}

/**
 * Checks if a given role is allowed
 * @param {string} userRole
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function isRoleAllowed(userRole, allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true; // No specific role required, any authenticated user allowed
  }
  return Boolean(userRole && allowedRoles.includes(userRole));
}
