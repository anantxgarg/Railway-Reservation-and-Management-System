'use strict';

const emailService = require('../../src/services/emailService');
const config = require('../../src/config/env');
const authService = require('../../src/services/authService');
const repo = require('../../src/services/userRepository');

jest.mock('../../src/services/userRepository', () => {
  const actual = jest.requireActual('../../src/services/userRepository');
  return {
    normaliseEmail: actual.normaliseEmail,
    findByEmail: jest.fn(),
    insertPasswordResetToken: jest.fn(),
  };
});
jest.mock('../../src/services/auditService', () => ({
  log: jest.fn().mockResolvedValue(true),
  ACTIONS: {
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
    PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  },
}));

describe('emailService — Brevo transactional email delivery API', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.resetFetch();
    consoleSpy = ['log', 'warn', 'error', 'info', 'debug'].map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {})
    );
  });

  afterEach(() => {
    emailService.resetFetch();
    jest.restoreAllMocks();
  });

  const getLoggedText = () => consoleSpy.flatMap((s) => s.mock.calls).map((c) => c.join(' ')).join('\n');

  test('parseSender parses formatted and plain email addresses', () => {
    expect(emailService.parseSender('"Railway Booking" <noreply@railway.com>')).toEqual({
      name: 'Railway Booking',
      email: 'noreply@railway.com',
    });
    expect(emailService.parseSender('noreply@railway.com')).toEqual({
      name: 'Railway Reservation',
      email: 'noreply@railway.com',
    });
    expect(emailService.parseSender(null)).toEqual({
      name: 'Railway Reservation',
      email: 'noreply@railway.local',
    });
  });

  test('buildResetUrl generates a valid URL with encoded token and base frontend URL', () => {
    const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const url = emailService.buildResetUrl(token);
    const base = (config.frontendUrl || config.corsOrigin || 'http://localhost:5173').replace(/\/+$/, '');
    expect(url).toBe(`${base}/reset-password?token=${token}`);
  });

  test('sendPasswordResetEmail skips sending when unconfigured and no custom fetch', async () => {
    const res = await emailService.sendPasswordResetEmail({
      to: 'customer@example.com',
      rawToken: 'dummy-token',
    });
    expect(res).toEqual({ skipped: true });
  });

  test('sendPasswordResetEmail sends request to Brevo API with api-key header and clickable link', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: '<brevo-msg-id-123>' }),
    });
    emailService.setFetch(mockFetch);

    const rawToken = 'test-token-value-12345';
    const recipient = 'user@example.com';

    const result = await emailService.sendPasswordResetEmail({
      to: recipient,
      rawToken,
    });

    expect(result).toEqual({ messageId: '<brevo-msg-id-123>' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': config.email.brevoApiKey,
    });

    const body = JSON.parse(options.body);
    expect(body.to).toEqual([{ email: recipient }]);
    expect(body.subject).toContain('Password Reset Request');
    expect(body.sender).toBeDefined();

    // Plain text and HTML contain clickable reset link
    const expectedBase = (config.frontendUrl || config.corsOrigin || 'http://localhost:5173').replace(/\/+$/, '');
    expect(body.textContent).toContain('/reset-password?token=test-token-value-12345');
    expect(body.htmlContent).toContain(`<a href="${expectedBase}/reset-password?token=test-token-value-12345"`);
    expect(body.htmlContent).toContain('Reset Password');

    // Never logs or exposes token, link, or credentials
    const logs = getLoggedText();
    expect(logs).not.toContain(rawToken);
    expect(logs).not.toContain('reset-password?token=');
  });

  test('sendPasswordResetEmail throws error when Brevo API returns non-2xx', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 'unauthorized', message: 'Key not found' }),
    });
    emailService.setFetch(mockFetch);

    await expect(
      emailService.sendPasswordResetEmail({
        to: 'user@example.com',
        rawToken: 'token-abc',
      })
    ).rejects.toThrow('Brevo API responded with status 401');
  });

  test('authService.requestPasswordReset triggers email delivery and preserves generic response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: '<brevo-msg-456>' }),
    });
    emailService.setFetch(mockFetch);

    repo.findByEmail.mockResolvedValue({
      user_id: 42,
      email: 'active@example.com',
      status: 'ACTIVE',
    });
    repo.insertPasswordResetToken.mockResolvedValue(1);

    const res = await authService.requestPasswordReset('Active@Example.Com');

    // Returns generic response
    expect(res).toEqual({});

    // Verify Brevo API was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.to).toEqual([{ email: 'active@example.com' }]);
    expect(body.htmlContent).toContain('reset-password?token=');

    // Logs must not expose raw token or reset URL
    const logs = getLoggedText();
    expect(logs).not.toContain('reset-password?token=');
  });

  test('authService.requestPasswordReset swallows Brevo API errors to prevent enumeration', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });
    emailService.setFetch(mockFetch);

    repo.findByEmail.mockResolvedValue({
      user_id: 42,
      email: 'active@example.com',
      status: 'ACTIVE',
    });
    repo.insertPasswordResetToken.mockResolvedValue(1);

    // Must not throw despite Brevo API failure
    await expect(authService.requestPasswordReset('active@example.com')).resolves.toEqual({});

    // Brevo API was attempted
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
