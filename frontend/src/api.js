// Shared HTTP client for the booking, payments, train and notification
// services (see vite.config.js for which service owns which /api path). Every
// call sends Team 1's access token from the same storage Team 1's login uses
// (utils/tokenStorage.js); when it has expired, the refresh token is traded
// for a new one once (services/session.js) and the call is retried.
import { tokenStorage } from './utils/tokenStorage.js';
import { expireSession, refreshSession } from './services/session.js';

export const getAuthToken = () => tokenStorage.getAccessToken() || '';

/**
 * The message of an error body. Team 1 and the booking service send
 * {"error": {"code", "message"}}; the payments app sends {"error": "message"}.
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

export async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  let { res, data } = await send(endpoint, method, body, token);

  if (res.status === 401 && token) {
    if (await refreshSession()) {
      ({ res, data } = await send(endpoint, method, body, getAuthToken()));
    }
    if (res.status === 401) expireSession();
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
  // only unpaid (HELD) bookings; paid ones are cancelled through api.requestRefund
  cancel: (pnr, passengerIds) =>
    apiRequest(`/api/bookings/${encodeURIComponent(pnr)}/cancel`, 'POST', { passengerIds }),
};

// ---------- Team 4: payments, refunds, concessions ----------

export const api = {
  // Payments: the amount always comes from the booking
  createPaymentOrder: (pnr) => apiRequest('/api/payments/order', 'POST', { pnr }),
  verifyPayment: (payload) => apiRequest('/api/payments/verify', 'POST', payload),
  getMyPayments: () => apiRequest('/api/payments/my'),
  getPaymentsForBooking: (pnr) => apiRequest(`/api/payments/booking/${encodeURIComponent(pnr)}`),

  // Concessions
  getConcessionPreview: (category, baseFare) =>
    apiRequest(`/api/concessions/preview?${query({ category, baseFare })}`),
  applyConcession: (payload) => apiRequest('/api/concessions/apply', 'POST', payload),
  getMyConcessions: () => apiRequest('/api/concessions/my'),
  getPendingConcessions: () => apiRequest('/api/concessions/pending'),
  reviewConcession: (id, payload) => apiRequest(`/api/concessions/${id}/review`, 'POST', payload),

  // Refunds: cancel passengers of a paid booking and refund them, in one step.
  // No passengerIds means everyone still on the booking.
  previewRefund: (pnr, passengerIds) =>
    apiRequest(`/api/refunds/preview/${encodeURIComponent(pnr)}?${query({ passengerIds: passengerIds?.join(',') })}`),
  requestRefund: (payload) => apiRequest('/api/refunds', 'POST', payload),
  getMyRefunds: () => apiRequest('/api/refunds/my'),
  getRefundsForBooking: (pnr) => apiRequest(`/api/refunds/booking/${encodeURIComponent(pnr)}`),
};
