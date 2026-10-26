import { apiRequest } from './api.js';

export const authService = {
  /**
   * Authenticate with email & password
   * Endpoint: POST /api/auth/login
   */
  async login({ email, password }) {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.trim(),
        password,
      },
    });
  },

  /**
   * Authenticate for the Admin Portal. Backend issues tokens only to ACTIVE ADMINs.
   * Endpoint: POST /api/auth/admin-login
   */
  async adminLogin({ email, password }) {
    return apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: {
        email: email.trim(),
        password,
      },
    });
  },

  /**
   * Register a new customer account
   * Endpoint: POST /api/auth/register
   */
  async register({ name, email, phone, password }) {
    const payload = {
      name: name.trim(),
      email: email.trim(),
      password,
    };
    if (phone && phone.trim()) {
      payload.phone = phone.trim();
    }

    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
  },

  /**
   * Get authenticated user profile
   * Endpoint: GET /api/auth/me
   */
  async getMe(token) {
    return apiRequest('/api/auth/me', {
      method: 'GET',
      token,
    });
  },

  /**
   * Rotate access and refresh tokens
   * Endpoint: POST /api/auth/refresh
   */
  async refreshTokens(refreshToken) {
    return apiRequest('/api/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken: refreshToken.trim(),
      },
    });
  },

  /**
   * Log out authenticated user & revoke server-side refresh tokens
   * Endpoint: POST /api/auth/logout
   */
  async logout(token) {
    return apiRequest('/api/auth/logout', {
      method: 'POST',
      token,
    });
  },

  /**
   * Request password reset token / link
   * Endpoint: POST /api/auth/forgot-password
   */
  async forgotPassword({ email }) {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        email: email.trim(),
      },
    });
  },

  /**
   * Reset password using token
   * Endpoint: POST /api/auth/reset-password
   */
  async resetPassword({ token, newPassword }) {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.trim(),
        newPassword,
      },
    });
  },

  /**
   * Change password for authenticated user
   * Endpoint: POST /api/auth/change-password
   */
  async changePassword({ currentPassword, newPassword }, token) {
    return apiRequest('/api/auth/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword,
        newPassword,
      },
    });
  },

  /**
   * Check backend health
   * Endpoint: GET /health
   */
  async checkHealth() {
    return apiRequest('/health', {
      method: 'GET',
    });
  },
};
