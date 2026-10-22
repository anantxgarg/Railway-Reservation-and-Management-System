/**
 * Token and Session Storage Utility
 * 
 * Based on Team 1 Phase 0 API Contract:
 * - Access Token: short-lived JWT passed via Authorization: Bearer <token>
 * - Refresh Token: long-lived opaque hex token passed in request body
 * - User: authenticated identity details { userId, name, email, role }
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'railway_access_token',
  REFRESH_TOKEN: 'railway_refresh_token',
  USER: 'railway_user',
};

export const tokenStorage = {
  getAccessToken() {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null;
    } catch {
      return null;
    }
  },

  getRefreshToken() {
    try {
      return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || null;
    } catch {
      return null;
    }
  },

  getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveSession({ token, refreshToken, user }) {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('[tokenStorage] Failed to save session to localStorage:', e);
    }
  },

  updateTokens(token, refreshToken) {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
    } catch (e) {
      console.warn('[tokenStorage] Failed to update tokens in localStorage:', e);
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.warn('[tokenStorage] Failed to clear session from localStorage:', e);
    }
  },

  hasTokens() {
    return Boolean(this.getAccessToken() || this.getRefreshToken());
  },
};
