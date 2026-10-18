'use strict';

const config = require('../config/env');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

let customFetch = null;

/**
 * Parses sender string (e.g. '"Railway Reservation" <noreply@railway.local>' or 'noreply@railway.local')
 * into { name, email }.
 *
 * @param {string} fromStr
 * @returns {{name: string, email: string}}
 */
function parseSender(fromStr) {
  if (!fromStr || typeof fromStr !== 'string') {
    return { name: 'Railway Reservation', email: 'noreply@railway.local' };
  }
  const match = fromStr.match(/^\s*(?:"?([^"]*)"?\s*)?<([^>]+)>\s*$/);
  if (match) {
    const name = match[1] ? match[1].trim() : 'Railway Reservation';
    const email = match[2].trim();
    return { name: name || 'Railway Reservation', email };
  }
  return { name: 'Railway Reservation', email: fromStr.trim() };
}

/**
 * Checks if Brevo API is configured.
 *
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(config.email.brevoApiKey && config.email.brevoApiKey.trim());
}

/**
 * Builds the password reset URL with the raw reset token.
 *
 * @param {string} rawToken
 * @returns {string}
 */
function buildResetUrl(rawToken) {
  const base = (config.frontendUrl || config.corsOrigin || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Set a custom fetch function (used by tests to mock API calls).
 *
 * @param {Function|null} fn
 */
function setFetch(fn) {
  customFetch = fn;
}

/**
 * Reset fetch function to default.
 */
function resetFetch() {
  customFetch = null;
}

/**
 * Sends a password reset email via Brevo transactional email API.
 * Never logs or exposes tokens, reset URLs, or API keys.
 *
 * @param {{to: string, rawToken: string}} params
 * @returns {Promise<{messageId?: string, skipped?: boolean}>}
 */
async function sendPasswordResetEmail({ to, rawToken }) {
  if (!isConfigured() && !customFetch) {
    return { skipped: true };
  }

  const resetUrl = buildResetUrl(rawToken);
  const expiresMinutes = config.resetTokenExpiresMinutes || 60;
  const sender = parseSender(config.email.from);
  const fetchFn = customFetch || globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    throw new Error('Fetch API is not available');
  }

  const textContent = [
    'You requested a password reset for your Railway Reservation account.',
    '',
    `To set a new password, open this link (valid for ${expiresMinutes} minutes):`,
    resetUrl,
    '',
    'If you did not request this, please disregard this email. Your password will remain unchanged.',
  ].join('\n');

  const htmlContent = [
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">',
    '  <h2 style="color: #1e3a8a; margin-top: 0;">Railway Reservation System</h2>',
    '  <h3 style="color: #334155;">Password Reset Request</h3>',
    '  <p>You requested a password reset for your account.</p>',
    `  <p>Click the button below to reset your password. This link is valid for <strong>${expiresMinutes} minutes</strong>.</p>`,
    '  <div style="margin: 28px 0;">',
    `    <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>`,
    '  </div>',
    '  <p style="font-size: 14px; color: #64748b;">If the button above does not work, copy and paste this link into your browser:</p>',
    `  <p style="font-size: 13px; word-break: break-all; color: #2563eb;"><a href="${resetUrl}">${resetUrl}</a></p>`,
    '  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />',
    '  <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>',
    '</div>',
  ].join('\n');

  const response = await fetchFn(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': config.email.brevoApiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject: 'Password Reset Request — Railway Reservation System',
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo API responded with status ${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  return { messageId: data.messageId };
}

module.exports = {
  sendPasswordResetEmail,
  buildResetUrl,
  parseSender,
  isConfigured,
  setFetch,
  resetFetch,
  BREVO_API_URL,
};
