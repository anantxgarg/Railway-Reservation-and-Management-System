/**
 * Base HTTP request utility for Team 1 API integration
 * Proxied via Vite to http://localhost:3000
 */
import { tokenStorage } from '../utils/tokenStorage.js';
import { expireSession, onSessionExpired, refreshSession } from './session.js';

export class ApiError extends Error {
  constructor(message, { status, code, fields = [], raw = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.raw = raw;
  }
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  '/api';

export { onSessionExpired };

export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, token, _isRetry = false } = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint.replace(/^\/api/, '') : `/${endpoint}`}`;

  // If token is not explicitly passed, check tokenStorage
  const activeToken = token !== undefined ? token : tokenStorage.getAccessToken();

  const requestHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  if (activeToken) {
    requestHeaders['Authorization'] = `Bearer ${activeToken}`;
  }

  const options = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new ApiError(
      'Unable to connect to the authentication server. Please verify the backend is running at http://localhost:3000.',
      {
        status: 0,
        code: 'NETWORK_ERROR',
        raw: networkError,
      }
    );
  }

  let responseData = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      responseData = { message: text };
    } catch {
      responseData = null;
    }
  }

  // Handle Token Expiry and Auto-Refresh
  if (
    response.status === 401 &&
    responseData?.error?.code === 'TOKEN_EXPIRED' &&
    !_isRetry &&
    !endpoint.includes('/refresh') &&
    !endpoint.includes('/login')
  ) {
    // Shared single-flight refresh (services/session.js), then retry once
    if (await refreshSession()) {
      return apiRequest(endpoint, {
        method,
        body,
        headers,
        token: tokenStorage.getAccessToken(),
        _isRetry: true,
      });
    }
    expireSession();
  }

  if (!response.ok) {
    const errorPayload = responseData?.error || responseData;
    let errorMessage = errorPayload?.message || responseData?.message;

    if (!errorMessage) {
      if (response.status === 502 || response.status === 504) {
        errorMessage = 'Authentication backend is unreachable (HTTP 502 Bad Gateway). Please verify the backend is started at http://localhost:3000.';
      } else {
        errorMessage = `Server returned HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
      }
    }

    const errorCode = errorPayload?.code || (response.status === 502 ? 'BACKEND_UNAVAILABLE' : `HTTP_${response.status}`);
    const fields = Array.isArray(errorPayload?.fields) ? errorPayload.fields : [];

    throw new ApiError(errorMessage, {
      status: response.status,
      code: errorCode,
      fields,
      raw: responseData,
    });
  }

  return responseData;
}
