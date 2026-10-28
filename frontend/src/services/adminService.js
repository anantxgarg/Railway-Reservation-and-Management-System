import { apiRequest } from './api.js';

/**
 * Admin API client. Every call is authorised server-side
 * (authenticate + MANAGE_USERS / ADMIN role); the frontend never decides access.
 */
export const adminService = {
  /**
   * Unlock a LOCKED account.
   * Endpoint: POST /api/admin/users/:userId/unlock  (MANAGE_USERS)
   */
  async unlockUser(userId) {
    return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/unlock`, {
      method: 'POST',
    });
  },

  /**
   * Look up a user profile by id.
   * Endpoint: GET /api/users/:userId  (owner or ADMIN)
   */
  async getUser(userId) {
    return apiRequest(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
    });
  },
};
