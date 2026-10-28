/**
 * Session lifecycle shared by both HTTP clients: Team 1's services/api.js and
 * the booking/payments/notifications client in src/api.js.
 *
 * - refreshSession(): trades the refresh token for a new pair. Single-flight,
 *   so calls that hit an expired token together rotate it only once (Team 1
 *   revokes a refresh token on use, so a second parallel refresh would fail).
 * - expireSession(): clears the stored session and tells AuthContext, which
 *   shows the login page with a message.
 */
import { tokenStorage } from '../utils/tokenStorage.js';

let sessionExpiredCallback = null;

export function onSessionExpired(callback) {
  sessionExpiredCallback = callback;
}

export function expireSession(message = 'Your session has expired. Please sign in again.') {
  tokenStorage.clearSession();
  if (sessionExpiredCallback) sessionExpiredCallback(message);
}

let refreshing = null;

/** Resolves to true when a new access token was stored. */
export function refreshSession() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.token) return false;
        tokenStorage.updateTokens(data.token, data.refreshToken || refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
