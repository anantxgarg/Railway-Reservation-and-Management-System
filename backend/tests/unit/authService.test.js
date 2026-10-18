/**
 * Service-level behaviour with the repository and audit log mocked (OFFLINE):
 *   D1  login/lockout decisions    D2  reset-token exposure
 *   D5  reset / refresh outcomes   audit content hygiene
 * Atomicity/concurrency itself needs PostgreSQL — see tests/auth.test.js and
 * tests/db/atomicity.db.test.js.
 */
'use strict';

const bcrypt = require('bcryptjs');

jest.mock('../../src/services/userRepository', () => {
  const actual = jest.requireActual('../../src/services/userRepository');
  return {
    normaliseEmail: actual.normaliseEmail,
    sha256hex: actual.sha256hex,
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findPasswordRecord: jest.fn(),
    createCustomer: jest.fn(),
    recordSuccessfulLogin: jest.fn(),
    incrementFailedLogin: jest.fn(),
    unlockUser: jest.fn(),
    insertRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    insertPasswordResetToken: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    changePasswordAndRevokeSessions: jest.fn(),
    hasPermission: jest.fn(),
  };
});
jest.mock('../../src/services/auditService', () => ({
  ACTIONS: jest.requireActual('../../src/services/auditService').ACTIONS,
  log: jest.fn().mockResolvedValue(undefined),
}));

const repo         = require('../../src/services/userRepository');
const audit        = require('../../src/services/auditService');
const config       = require('../../src/config/env');
const authService  = require('../../src/services/authService');
const tokenService = require('../../src/services/tokenService');

const PASSWORD = 'Railway@Secure1!';
let HASH;
beforeAll(async () => { HASH = await bcrypt.hash(PASSWORD, 4); }); // low cost: speed only

const mkUser = (over = {}) => ({
  user_id: 11, name: 'U', email: 'u@example.com', password_hash: HASH,
  status: 'ACTIVE', role_name: 'CUSTOMER', failed_login_attempts: 0, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  config.devExposeResetToken = false;
  repo.incrementFailedLogin.mockResolvedValue({ counted: true, newCount: 1, wasLocked: false });
  repo.recordSuccessfulLogin.mockResolvedValue(true);
  repo.insertRefreshToken.mockResolvedValue(1);
});

describe('D1 — login and lockout', () => {
  test('ACTIVE + correct password issues tokens and records the login', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    const res = await authService.login({ email: 'U@Example.com', password: PASSWORD });
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toMatch(/^[0-9a-f]{128}$/);
    expect(res.user).toEqual({ userId: 11, name: 'U', email: 'u@example.com', role: 'CUSTOMER' });
    expect(repo.recordSuccessfulLogin).toHaveBeenCalledWith(11);
    expect(JSON.stringify(res)).not.toMatch(/password_hash|\$2[aby]\$/);
  });

  test('wrong password on ACTIVE account counts a failure with the configured threshold', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    await expect(authService.login({ email: 'u@example.com', password: 'Wrong@Pass1' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(repo.incrementFailedLogin).toHaveBeenCalledWith(11, config.loginLockoutThreshold);
    expect(repo.insertRefreshToken).not.toHaveBeenCalled();
  });

  test('the failure that triggers the lock is audited as ACCOUNT_LOCKED (FAILURE)', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    repo.incrementFailedLogin.mockResolvedValue({ counted: true, newCount: 3, wasLocked: true });
    await expect(authService.login({ email: 'u@example.com', password: 'Wrong@Pass1' })).rejects.toBeDefined();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ACCOUNT_LOCKED', result: 'FAILURE', userId: '11',
    }));
  });

  test.each(['SUSPENDED', 'INACTIVE', 'LOCKED', 'PENDING'])(
    '%s account with CORRECT password is refused (403 code) and gets no token',
    async (status) => {
      repo.findByEmail.mockResolvedValue(mkUser({ status }));
      await expect(authService.login({ email: 'u@example.com', password: PASSWORD }))
        .rejects.toMatchObject({ code: 'ACCOUNT_NOT_ACTIVE', status });
      expect(repo.recordSuccessfulLogin).not.toHaveBeenCalled();
      expect(repo.insertRefreshToken).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_BLOCKED', result: 'FAILURE' }));
    }
  );

  test('login does not issue a token if the account stopped being ACTIVE mid-request', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    repo.recordSuccessfulLogin.mockResolvedValue(false); // UPDATE ... WHERE status='ACTIVE' matched nothing
    await expect(authService.login({ email: 'u@example.com', password: PASSWORD }))
      .rejects.toMatchObject({ code: 'ACCOUNT_NOT_ACTIVE' });
    expect(repo.insertRefreshToken).not.toHaveBeenCalled();
  });

  test('unknown email and wrong password give the same client-visible error', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    const a = await authService.login({ email: 'nobody@example.com', password: PASSWORD }).catch((e) => e);
    repo.findByEmail.mockResolvedValueOnce(mkUser());
    const b = await authService.login({ email: 'u@example.com', password: 'Wrong@Pass1' }).catch((e) => e);
    expect(a.code).toBe('INVALID_CREDENTIALS');
    expect(b.code).toBe('INVALID_CREDENTIALS');
    expect(a.message).toBe(b.message);
  });
});

describe('D2 — password-reset token exposure', () => {
  let spies;
  beforeEach(() => {
    spies = ['log', 'warn', 'error', 'info', 'debug'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  });
  afterEach(() => jest.restoreAllMocks());

  const consoleText = () => spies.flatMap((s) => s.mock.calls).map((c) => c.join(' ')).join('\n');

  test('DEFAULT: no devToken is returned and the raw token is never logged', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    const out = await authService.requestPasswordReset('u@example.com', { ipAddress: '1.1.1.1' });
    expect(out).toEqual({});
    expect(repo.insertPasswordResetToken).toHaveBeenCalledTimes(1);
    const { rawToken, ttlSeconds, userId } = repo.insertPasswordResetToken.mock.calls[0][0];
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/); // 256-bit CSPRNG, hex
    expect(ttlSeconds).toBe(config.resetTokenExpiresMinutes * 60);
    expect(userId).toBe(11);
    expect(consoleText()).not.toContain(rawToken);
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain(rawToken);
  });

  test('explicit opt-in returns the token but still never logs it', async () => {
    config.devExposeResetToken = true;
    repo.findByEmail.mockResolvedValue(mkUser());
    const out = await authService.requestPasswordReset('u@example.com');
    const { rawToken } = repo.insertPasswordResetToken.mock.calls[0][0];
    expect(out).toEqual({ devToken: rawToken });
    expect(consoleText()).not.toContain(rawToken);
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain(rawToken);
  });

  test('NODE_ENV alone never exposes the token (default flag + non-production env)', async () => {
    expect(config.isProd).toBe(false); // we are in "test", not production
    repo.findByEmail.mockResolvedValue(mkUser());
    expect(await authService.requestPasswordReset('u@example.com')).toEqual({});
  });

  test('each request generates a different token', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    await authService.requestPasswordReset('u@example.com');
    await authService.requestPasswordReset('u@example.com');
    const [a, b] = repo.insertPasswordResetToken.mock.calls.map((c) => c[0].rawToken);
    expect(a).not.toBe(b);
  });

  test.each([
    ['unknown e-mail', null],
    ['SUSPENDED account', mkUser({ status: 'SUSPENDED' })],
    ['LOCKED account', mkUser({ status: 'LOCKED' })],
  ])('%s: returns {} and creates NO token (response indistinguishable from a normal request)', async (_n, user) => {
    config.devExposeResetToken = true; // even with the dev flag: nothing to expose
    repo.findByEmail.mockResolvedValue(user);
    expect(await authService.requestPasswordReset('x@example.com')).toEqual({});
    expect(repo.insertPasswordResetToken).not.toHaveBeenCalled();
  });
});

describe('D5 — password reset outcome handling', () => {
  test('hashes the new password with bcrypt before the atomic repository call', async () => {
    repo.resetPasswordWithToken.mockResolvedValue(11);
    await authService.resetPassword({ token: 'tok', newPassword: PASSWORD });
    const arg = repo.resetPasswordWithToken.mock.calls[0][0];
    expect(arg.rawToken).toBe('tok');
    expect(arg.newPasswordHash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(arg.newPasswordHash).not.toContain(PASSWORD);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_RESET_COMPLETED', result: 'SUCCESS', userId: '11' }));
  });

  test('invalid / expired / already-used token → INVALID_RESET_TOKEN and a FAILURE audit with no token', async () => {
    repo.resetPasswordWithToken.mockResolvedValue(null);
    await expect(authService.resetPassword({ token: 'SECRET-TOKEN-VALUE', newPassword: PASSWORD }))
      .rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ result: 'FAILURE', userId: null }));
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('SECRET-TOKEN-VALUE');
  });

  test('the service performs no separate lookup/consume (single atomic repository call)', async () => {
    repo.resetPasswordWithToken.mockResolvedValue(11);
    await authService.resetPassword({ token: 't', newPassword: PASSWORD });
    expect(repo.resetPasswordWithToken).toHaveBeenCalledTimes(1);
    expect(repo.revokeAllUserRefreshTokens).not.toHaveBeenCalled(); // done inside the same transaction
  });

  test('change-password uses the atomic update+revoke and rejects wrong current password', async () => {
    repo.findPasswordRecord.mockResolvedValue({ password_hash: HASH, status: 'ACTIVE' });
    repo.changePasswordAndRevokeSessions.mockResolvedValue(true);
    await authService.changePassword(11, { currentPassword: PASSWORD, newPassword: 'New@Passw0rd!' });
    expect(repo.changePasswordAndRevokeSessions).toHaveBeenCalledWith(11, expect.stringMatching(/^\$2[aby]\$/));

    repo.changePasswordAndRevokeSessions.mockClear();
    await expect(authService.changePassword(11, { currentPassword: 'Wrong@Pass1', newPassword: 'New@Passw0rd!' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(repo.changePasswordAndRevokeSessions).not.toHaveBeenCalled();
  });
});

describe('D5 — refresh-token rotation outcome handling', () => {
  const rotate = (raw = 'old') => tokenService.rotateRefreshToken(raw);

  test('success: passes old + a NEW random token and the TTL; returns a signed access token', async () => {
    repo.rotateRefreshToken.mockResolvedValue({ ok: true, userId: 11, role: 'CUSTOMER' });
    const out = await rotate('old-raw');
    const arg = repo.rotateRefreshToken.mock.calls[0][0];
    expect(arg.rawOldToken).toBe('old-raw');
    expect(arg.rawNewToken).toMatch(/^[0-9a-f]{128}$/);
    expect(arg.rawNewToken).not.toBe('old-raw');
    expect(arg.ttlSeconds).toBe(config.refreshTokenExpiresDays * 86400);
    expect(out.refreshToken).toBe(arg.rawNewToken);
    expect(tokenService.verifyAccessToken(out.accessToken)).toMatchObject({ sub: '11', role: 'CUSTOMER' });
  });

  test.each([
    ['NOT_FOUND', 'INVALID_REFRESH_TOKEN'],
    ['REVOKED',   'INVALID_REFRESH_TOKEN'],
    ['REUSED',    'INVALID_REFRESH_TOKEN'],
    ['EXPIRED',   'EXPIRED_REFRESH_TOKEN'],
    ['INACTIVE',  'ACCOUNT_NOT_ACTIVE'],
  ])('%s → %s', async (reason, code) => {
    repo.rotateRefreshToken.mockResolvedValue({ ok: false, reason, userId: 11 });
    await expect(rotate()).rejects.toMatchObject({ code });
  });

  test('reuse is indistinguishable to the client but flagged for audit', async () => {
    repo.rotateRefreshToken.mockResolvedValue({ ok: false, reason: 'REUSED', userId: 11 });
    const reused = await rotate().catch((e) => e);
    repo.rotateRefreshToken.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
    const unknown = await rotate().catch((e) => e);
    expect(reused.message).toBe(unknown.message);
    expect(reused.reuseDetected).toBe(true);
    expect(unknown.reuseDetected).toBe(false);
  });

  test('authService.refreshTokens audits TOKEN_REUSE_DETECTED (FAILURE) with the user id as a string', async () => {
    repo.rotateRefreshToken.mockResolvedValue({ ok: false, reason: 'REUSED', userId: 11 });
    await expect(authService.refreshTokens('old')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TOKEN_REUSE_DETECTED', result: 'FAILURE', userId: '11',
    }));
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('old"');
  });
});

describe('audit content hygiene', () => {
  test('login success + failure never put the password, hash or tokens in audit calls', async () => {
    repo.findByEmail.mockResolvedValue(mkUser());
    const ok = await authService.login({ email: 'u@example.com', password: PASSWORD });
    await authService.login({ email: 'u@example.com', password: 'Wrong@Pass1' }).catch(() => {});
    const dump = JSON.stringify(audit.log.mock.calls);
    [PASSWORD, 'Wrong@Pass1', HASH, ok.accessToken, ok.refreshToken].forEach((s) => expect(dump).not.toContain(s));
    audit.log.mock.calls.forEach(([e]) => {
      expect(e.userId === null || typeof e.userId === 'string').toBe(true);
      expect(['SUCCESS', 'FAILURE']).toContain(e.result);
    });
  });
});
