// HTTP client for booking-service, the only backend of the Team 3 demo (see
// vite.config.js). Every call sends the access token from /api/auth/login
// (Team 1's auth API, answered by booking-service in demo mode); when it has
// expired, the refresh token is traded for a new one once and the call is
// retried.

const TOKEN_KEY = 'railway_jwt_token';
const REFRESH_KEY = 'railway_refresh_token';
const USER_KEY = 'railway_user_data';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    // private window or storage blocked: the session lasts until reload
  }
};

/** The logged-in user ({userId, name, email, role, ...}) or null. */
export const getCurrentUser = () => {
  try {
    const raw = read(USER_KEY);
    return raw && read(TOKEN_KEY) ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const getAuthToken = () => read(TOKEN_KEY) || '';

export const setAuthSession = (token, refreshToken, user) => {
  write(TOKEN_KEY, token);
  write(REFRESH_KEY, refreshToken);
  write(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  write(TOKEN_KEY, null);
  write(REFRESH_KEY, null);
  write(USER_KEY, null);
};

// App.jsx registers this to show the login page when the session is gone.
let onSessionEnded = () => {};
export const setSessionEndedHandler = (handler) => {
  onSessionEnded = handler;
};

/**
 * The message of an error body: {"error": {"code", "message"}} from the
 * booking service (and Team 1's auth API), or a plain {"error": "message"}.
 */
export const errorMessage = (data, status) => {
  if (data?.error && typeof data.error === 'object') {
    const fields = data.error.fields?.map((f) => `${f.field}: ${f.message}`).join('; ');
    return fields ? `${data.error.message} (${fields})` : data.error.message;
  }
  if (typeof data?.error === 'string') return data.error;
  return data?.message || `Request failed with status ${status}`;
};

async function send(endpoint, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // empty or non-JSON body
  }
  return { res, data };
}

// One refresh at a time, shared by all calls that hit an expired token together.
let refreshing = null;

async function refreshSession() {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = send('/api/auth/refresh', 'POST', { refreshToken })
      .then(({ res, data }) => {
        if (!res.ok || !data?.token) return false;
        write(TOKEN_KEY, data.token);
        write(REFRESH_KEY, data.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  let { res, data } = await send(endpoint, method, body, token);

  if (res.status === 401 && token) {
    if (await refreshSession()) {
      ({ res, data } = await send(endpoint, method, body, getAuthToken()));
    }
    if (res.status === 401) {
      clearAuthSession();
      onSessionEnded();
    }
  }

  if (!res.ok) {
    const err = new Error(errorMessage(data, res.status));
    err.status = res.status;
    err.code = data?.error?.code;
    err.details = data;
    throw err;
  }
  return data;
}

// ---------- Auth: Team 1's API, served by booking-service in demo mode ----------

export async function login(email, password) {
  const { res, data } = await send('/api/auth/login', 'POST', { email, password });
  if (!res.ok) {
    const err = new Error(errorMessage(data, res.status));
    err.status = res.status;
    throw err;
  }
  setAuthSession(data.token, data.refreshToken, data.user);
  return data.user;
}

export async function logout() {
  try {
    await apiRequest('/api/auth/logout', 'POST');
  } catch (e) {
    // the session ends locally either way
  }
  clearAuthSession();
}

// ---------- Team 3: search, availability, bookings (booking-service) ----------

const query = (params) => new URLSearchParams(
  Object.entries(params).filter(([, v]) => v != null && v !== '')
).toString();

export const bookingApi = {
  search: (from, to, date) => apiRequest(`/api/search?${query({ from, to, date })}`),
  availability: (runId, params) => apiRequest(`/api/runs/${runId}/availability?${query(params)}`),
  create: (payload) => apiRequest('/api/bookings', 'POST', payload),
  mine: () => apiRequest('/api/bookings/mine'),
  get: (pnr) => apiRequest(`/api/bookings/${encodeURIComponent(pnr)}`),
  // HELD, or CONFIRMED in demo mode; no passengerIds means everyone still on the booking
  cancel: (pnr, passengerIds) =>
    apiRequest(`/api/bookings/${encodeURIComponent(pnr)}/cancel`, 'POST', { passengerIds }),
  // Demo mode only: confirms a HELD booking without a real payment, standing in
  // for Team 4's checkout. Answers with the booking, like get().
  demoPay: (pnr) => apiRequest(`/api/bookings/${encodeURIComponent(pnr)}/demo-pay`, 'POST'),
};
