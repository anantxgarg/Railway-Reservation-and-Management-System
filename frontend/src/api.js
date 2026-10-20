const TOKEN_KEY = 'railway_jwt_token';
const ROLE_KEY = 'railway_user_role';
const USER_KEY = 'railway_user_data';

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : { userId: 1, email: 'customer@railway.gov.in', role: 'CUSTOMER' };
  } catch (e) {
    return { userId: 1, email: 'customer@railway.gov.in', role: 'CUSTOMER' };
  }
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY) || '';

export const setAuthSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(ROLE_KEY, user.role);
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export async function loginWithRole(role, userId = 1, email = null) {
  const defaultEmail = role === 'STAFF' 
    ? 'staff@railways.gov.in' 
    : role === 'ADMIN' 
      ? 'admin@railways.gov.in' 
      : 'passenger@railways.gov.in';

  const user = {
    userId: role === 'STAFF' ? 99 : role === 'ADMIN' ? 999 : userId,
    email: email || defaultEmail,
    role: role
  };

  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });

  if (!response.ok) {
    throw new Error('Failed to generate authentication token');
  }

  const data = await response.json();
  setAuthSession(data.token, user);
  return { token: data.token, user };
}

export async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore empty response bodies
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

// Module 4 API Helpers
export const api = {
  // Booking & Payments
  createBooking: (payload) => apiRequest('/api/bookings', 'POST', payload),
  getBooking: (id) => apiRequest(`/api/bookings/${id}`, 'GET'),
  createPaymentOrder: (bookingId) => apiRequest('/api/payments/order', 'POST', { bookingId }),
  verifyPayment: (payload) => apiRequest('/api/payments/verify', 'POST', payload),
  getMyPayments: () => apiRequest('/api/payments/my', 'GET'),
  getPaymentsForBooking: (bookingId) => apiRequest(`/api/payments/booking/${bookingId}`, 'GET'),

  // Concessions
  getConcessionPreviews: () => apiRequest('/api/concessions/preview', 'GET'),
  applyConcession: (payload) => apiRequest('/api/concessions/apply', 'POST', payload),
  getMyConcessions: () => apiRequest('/api/concessions/my', 'GET'),
  getPendingConcessions: () => apiRequest('/api/concessions/pending', 'GET'),
  reviewConcession: (id, payload) => apiRequest(`/api/concessions/${id}/review`, 'POST', payload),

  // Refunds
  previewRefund: (bookingId) => apiRequest(`/api/refunds/preview/${bookingId}`, 'GET'),
  requestRefund: (payload) => apiRequest('/api/refunds', 'POST', payload),
  getMyRefunds: () => apiRequest('/api/refunds/my', 'GET'),
  getRefundsForBooking: (bookingId) => apiRequest(`/api/refunds/booking/${bookingId}`, 'GET'),
};
