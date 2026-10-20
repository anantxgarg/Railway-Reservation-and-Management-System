/**
 * D9 — JWT algorithm pinning. HS256 only; unsigned / other-algorithm /
 * wrong-secret / wrong-issuer / expired tokens are rejected.
 */
'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../../src/config/env');
const tokenService = require('../../src/services/tokenService');

const SECRET = config.jwtSecret;
const base   = { issuer: 'railway-api', audience: 'railway-client' };

const rejects = (token) => expect(() => tokenService.verifyAccessToken(token)).toThrow();

describe('access tokens', () => {
  test('sign/verify round trip carries only sub + role, with iss/aud/exp', () => {
    const t = tokenService.generateAccessToken({ userId: 7, role: 'CUSTOMER' });
    const p = tokenService.verifyAccessToken(t);
    expect(p.sub).toBe('7');
    expect(p.role).toBe('CUSTOMER');
    expect(p.iss).toBe('railway-api');
    expect(p.aud).toBe('railway-client');
    expect(p.exp).toBeGreaterThan(p.iat);
    expect(Object.keys(p).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'role', 'sub']);
  });

  test('issued token header declares HS256', () => {
    const t = tokenService.generateAccessToken({ userId: 1, role: 'ADMIN' });
    expect(jwt.decode(t, { complete: true }).header.alg).toBe('HS256');
    expect(tokenService.ALGORITHM).toBe('HS256');
  });

  test('rejects a token signed with the wrong secret', () => {
    rejects(jwt.sign({ sub: '1' }, 'another-secret-another-secret-another-secret!', base));
  });

  test('rejects an unsigned token (alg=none)', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', role: 'ADMIN', ...{ iss: 'railway-api', aud: 'railway-client' } })}.`;
    rejects(none);
  });

  test.each(['HS384', 'HS512'])('rejects a token signed with unexpected algorithm %s (correct secret)', (alg) => {
    rejects(jwt.sign({ sub: '1' }, SECRET, { ...base, algorithm: alg }));
  });

  test('rejects an RS256-labelled token (algorithm confusion)', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const fake = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ sub: '1' })}.c2ln`;
    rejects(fake);
  });

  test('rejects wrong issuer and wrong audience', () => {
    rejects(jwt.sign({ sub: '1' }, SECRET, { ...base, issuer: 'evil' }));
    rejects(jwt.sign({ sub: '1' }, SECRET, { ...base, audience: 'other' }));
  });

  test('rejects an expired token with TokenExpiredError', () => {
    const expired = jwt.sign({ sub: '1' }, SECRET, { ...base, expiresIn: -10 });
    expect(() => tokenService.verifyAccessToken(expired)).toThrow(/expired/i);
  });

  test('rejects malformed input', () => {
    rejects('garbage');
    rejects('a.b.c');
    rejects('');
  });

  test('refresh-token hash format is sha256 hex (64 chars)', () => {
    const repo = require('../../src/services/userRepository');
    expect(repo.sha256hex('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
