/**
 * Real application routes, real middleware (authenticate / authorize / validation),
 * with the repository and audit log mocked (OFFLINE).
 *
 * Covers: 401 vs 403, permission-from-database enforcement, ownership checks,
 * identity taken from the verified token (never the client), registration role
 * safety, generic recovery responses, and the seed-data source of truth.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const jwt  = require('jsonwebtoken');
const request = require('supertest');

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
    revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
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

const repo   = require('../../src/services/userRepository');
const audit  = require('../../src/services/auditService');
const config = require('../../src/config/env');
const tokenService = require('../../src/services/tokenService');
const app    = require('../../src/app');

// Fake directory standing in for the database
const USERS = {
  1: { user_id: 1, name: 'Admin',    email: 'admin@example.com',    role_name: 'ADMIN',    status: 'ACTIVE' },
  2: { user_id: 2, name: 'Customer', email: 'cust@example.com',     role_name: 'CUSTOMER', status: 'ACTIVE' },
  3: { user_id: 3, name: 'Staff',    email: 'staff@example.com',    role_name: 'STAFF',    status: 'ACTIVE' },
  4: { user_id: 4, name: 'Other',    email: 'other@example.com',    role_name: 'CUSTOMER', status: 'ACTIVE' },
  5: { user_id: 5, name: 'Locked',   email: 'locked@example.com',   role_name: 'CUSTOMER', status: 'LOCKED' },
  6: { user_id: 6, name: 'Susp',     email: 'susp@example.com',     role_name: 'CUSTOMER', status: 'SUSPENDED' },
};
// Mirrors seed.sql: MANAGE_USERS belongs to ADMIN only
const PERMS = { ADMIN: ['MANAGE_USERS', 'VIEW_PASSENGER'], STAFF: ['VIEW_PASSENGER'], CUSTOMER: [] };

const tokenFor = (id, claimedRole) =>
  tokenService.generateAccessToken({ userId: id, role: claimedRole || USERS[id].role_name });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => {
  jest.clearAllMocks();
  repo.findById.mockImplementation(async (id) => USERS[id] || null);
  repo.hasPermission.mockImplementation(async (id, perm) => {
    const u = USERS[id];
    return !!u && u.status === 'ACTIVE' && PERMS[u.role_name].includes(perm);
  });
  repo.revokeAllUserRefreshTokens.mockResolvedValue(undefined);
});

describe('POST /api/admin/users/:userId/unlock (real route: authenticate + MANAGE_USERS)', () => {
  const url = (id) => `/api/admin/users/${id}/unlock`;

  test('no credentials → 401 (not 403)', async () => {
    const res = await request(app).post(url(5));
    expect(res.status).toBe(401);
    expect(repo.unlockUser).not.toHaveBeenCalled();
  });

  test('malformed / invalid credentials → 401', async () => {
    expect((await request(app).post(url(5)).set(bearer('garbage'))).status).toBe(401);
    expect((await request(app).post(url(5)).set('Authorization', 'Basic abc')).status).toBe(401);
  });

  test('CUSTOMER → 403, permission looked up for the TOKEN identity, ACCESS_DENIED audited', async () => {
    const res = await request(app).post(url(5)).set(bearer(tokenFor(2)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(repo.hasPermission).toHaveBeenCalledWith(2, 'MANAGE_USERS');
    expect(repo.unlockUser).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ACCESS_DENIED', result: 'FAILURE', userId: '2', resourceType: 'ENDPOINT',
    }));
  });

  test('STAFF (no MANAGE_USERS in seed data) → 403', async () => {
    const res = await request(app).post(url(5)).set(bearer(tokenFor(3)));
    expect(res.status).toBe(403);
    expect(repo.unlockUser).not.toHaveBeenCalled();
  });

  test('forged ADMIN claim in the JWT does not help a CUSTOMER (permissions come from the database)', async () => {
    const forged = tokenFor(2, 'ADMIN'); // validly signed here, but claims a role the DB does not give user 2
    const res = await request(app).post(url(5)).set(bearer(forged));
    expect(res.status).toBe(403);
    expect(repo.unlockUser).not.toHaveBeenCalled();
  });

  test('client-supplied role / userId in body or query cannot grant access', async () => {
    const res = await request(app).post(`${url(5)}?role=ADMIN&userId=1`)
      .set(bearer(tokenFor(2)))
      .send({ role: 'ADMIN', userId: 1, user_id: 1, permissions: ['MANAGE_USERS'] });
    expect(res.status).toBe(403);
    expect(repo.hasPermission).toHaveBeenCalledWith(2, 'MANAGE_USERS');
    expect(repo.hasPermission).not.toHaveBeenCalledWith(1, expect.anything());
  });

  test('ADMIN → 200, unlocks the target, audits ACCOUNT_UNLOCKED with the actor from the token', async () => {
    repo.unlockUser.mockResolvedValue({ result: 'UNLOCKED' });
    const res = await request(app).post(url(5)).set(bearer(tokenFor(1))).send({ userId: 999 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Account unlocked', userId: 5 });
    expect(repo.unlockUser).toHaveBeenCalledWith(5);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ACCOUNT_UNLOCKED', result: 'SUCCESS', userId: '1', resourceId: '5',
    }));
  });

  test('ADMIN on a non-LOCKED account → 409 USER_NOT_LOCKED (SUSPENDED stays suspended)', async () => {
    repo.unlockUser.mockResolvedValue({ result: 'NOT_LOCKED', status: 'SUSPENDED' });
    const res = await request(app).post(url(6)).set(bearer(tokenFor(1)));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_NOT_LOCKED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACCOUNT_UNLOCKED', result: 'FAILURE' }));
  });

  test('ADMIN on unknown user → 404; non-numeric id → 400', async () => {
    repo.unlockUser.mockResolvedValue({ result: 'NOT_FOUND' });
    expect((await request(app).post(url(999)).set(bearer(tokenFor(1)))).status).toBe(404);
    expect((await request(app).post(url('abc')).set(bearer(tokenFor(1)))).status).toBe(400);
    expect((await request(app).post(url('0')).set(bearer(tokenFor(1)))).status).toBe(400);
  });

  test('an ADMIN who has been SUSPENDED loses access immediately (token still unexpired) → 401', async () => {
    const t = tokenFor(1);
    USERS[1].status = 'SUSPENDED';
    try {
      const res = await request(app).post(url(5)).set(bearer(t));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    } finally {
      USERS[1].status = 'ACTIVE';
    }
  });

  test('no role-assignment / role-change route exists (no unrestricted role assignment)', async () => {
    for (const [method, p] of [['post', '/api/admin/users/2/role'], ['put', '/api/admin/users/2/role'], ['patch', '/api/users/2'], ['post', '/api/admin/users']]) {
      const res = await request(app)[method](p).set(bearer(tokenFor(1))).send({ role: 'ADMIN' });
      expect([404]).toContain(res.status);
    }
  });
});

describe('GET /api/users/:userId (real route: authenticate + requireOwnership)', () => {
  test('no token → 401', async () => {
    expect((await request(app).get('/api/users/2')).status).toBe(401);
  });

  test('owner reads own profile → 200, no password fields', async () => {
    const res = await request(app).get('/api/users/2').set(bearer(tokenFor(2)));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('cust@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('another customer\'s profile → 403', async () => {
    expect((await request(app).get('/api/users/4').set(bearer(tokenFor(2)))).status).toBe(403);
  });

  test('STAFF cannot read an arbitrary customer profile → 403', async () => {
    expect((await request(app).get('/api/users/2').set(bearer(tokenFor(3)))).status).toBe(403);
  });

  test('ADMIN may read any profile → 200', async () => {
    const res = await request(app).get('/api/users/4').set(bearer(tokenFor(1)));
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(4);
  });

  test('ADMIN claim forged in the JWT of a CUSTOMER does not bypass ownership (role re-read from DB)', async () => {
    expect((await request(app).get('/api/users/4').set(bearer(tokenFor(2, 'ADMIN')))).status).toBe(403);
  });
});

describe('client-supplied identity is never trusted', () => {
  test('GET /me returns the token\'s user even if the body/query names someone else', async () => {
    const res = await request(app).get('/api/auth/me?userId=1&role=ADMIN')
      .set(bearer(tokenFor(2))).send({ userId: 1, role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(2);
    expect(res.body.role).toBe('CUSTOMER');
  });

  test('POST /logout revokes the TOKEN user\'s sessions, not the one named in the body', async () => {
    const res = await request(app).post('/api/auth/logout').set(bearer(tokenFor(2))).send({ userId: 1 });
    expect(res.status).toBe(200);
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith(2);
    expect(repo.revokeAllUserRefreshTokens).not.toHaveBeenCalledWith(1);
  });

  test('POST /change-password acts on the token user', async () => {
    repo.findPasswordRecord.mockResolvedValue(null);
    await request(app).post('/api/auth/change-password').set(bearer(tokenFor(2)))
      .send({ userId: 1, currentPassword: 'x', newPassword: 'Valid@Passw0rd1' });
    expect(repo.findPasswordRecord).toHaveBeenCalledWith(2);
  });

  test('token for a deleted user → 401', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer(tokenFor(2)).constructor === Object ? bearer(tokenService.generateAccessToken({ userId: 999, role: 'ADMIN' })) : {});
    expect(res.status).toBe(401);
  });

  test('expired and wrong-algorithm tokens → 401 with distinct codes', async () => {
    const base = { issuer: 'railway-api', audience: 'railway-client' };
    const expired = jwt.sign({ sub: '2', role: 'CUSTOMER' }, config.jwtSecret, { ...base, expiresIn: -5 });
    const hs512   = jwt.sign({ sub: '2', role: 'CUSTOMER' }, config.jwtSecret, { ...base, algorithm: 'HS512' });
    const r1 = await request(app).get('/api/auth/me').set(bearer(expired));
    const r2 = await request(app).get('/api/auth/me').set(bearer(hs512));
    expect([r1.status, r1.body.error.code]).toEqual([401, 'TOKEN_EXPIRED']);
    expect([r2.status, r2.body.error.code]).toEqual([401, 'INVALID_TOKEN']);
  });
});

describe('registration (public) cannot create privileged accounts', () => {
  beforeEach(() => {
    repo.findByEmail.mockResolvedValue(null);
    repo.createCustomer.mockImplementation(async ({ name, email, phone }) =>
      ({ user_id: 50, name, email, phone, status: 'ACTIVE' }));
  });

  test.each([
    { role: 'ADMIN' }, { role: 'STAFF' }, { roleId: 1 }, { role_id: 1 }, { role_name: 'ADMIN' }, { status: 'ACTIVE', isAdmin: true },
  ])('extra field %j is ignored; account is CUSTOMER', async (extra) => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve', email: 'Eve@Example.com', password: 'Railway@Secure1!', ...extra,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CUSTOMER');
    // Repository is only ever asked to create a CUSTOMER with exactly these inputs:
    const arg = repo.createCustomer.mock.calls[0][0];
    expect(Object.keys(arg).sort()).toEqual(['email', 'name', 'passwordHash', 'phone']);
  });

  test('bcrypt hash (60 chars, schema-compatible) is stored, never the plaintext; e-mail structure preserved', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Eve', email: ' John.Doe+rail@Gmail.com ', password: 'Railway@Secure1!',
    });
    const arg = repo.createCustomer.mock.calls[0][0];
    expect(arg.passwordHash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(arg.passwordHash).toHaveLength(60);
    expect(arg.passwordHash).not.toContain('Railway@Secure1!');
    expect(arg.email).toBe('john.doe+rail@gmail.com');
  });

  test('duplicate e-mail → 409 EMAIL_TAKEN (documented residual enumeration channel)', async () => {
    repo.findByEmail.mockResolvedValue({ user_id: 1 });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve', email: 'eve@example.com', password: 'Railway@Secure1!',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(repo.createCustomer).not.toHaveBeenCalled();
  });

  test('unique-violation race (23505) is also reported as 409', async () => {
    repo.createCustomer.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve', email: 'eve@example.com', password: 'Railway@Secure1!',
    });
    expect(res.status).toBe(409);
  });
});

describe('forgot-password responses (D2 / D7)', () => {
  const body = { email: 'cust@example.com' };

  test('known e-mail, unknown e-mail and SUSPENDED account give an identical response, with no token fields', async () => {
    repo.findByEmail.mockResolvedValueOnce({ ...USERS[2], password_hash: 'x' });
    const known = await request(app).post('/api/auth/forgot-password').send(body);
    repo.findByEmail.mockResolvedValueOnce(null);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    repo.findByEmail.mockResolvedValueOnce({ ...USERS[6], password_hash: 'x' });
    const suspended = await request(app).post('/api/auth/forgot-password').send({ email: 'susp@example.com' });

    for (const r of [known, unknown, suspended]) {
      expect(r.status).toBe(200);
      expect(r.body).toEqual(known.body);
      expect(r.body.devToken).toBeUndefined();
      expect(r.body.devNote).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toMatch(/[0-9a-f]{64}/);
    }
    expect(repo.insertPasswordResetToken).toHaveBeenCalledTimes(1); // only the ACTIVE known account
  });

  test('default configuration: the raw token never appears in any response header or body', async () => {
    repo.findByEmail.mockResolvedValue({ ...USERS[2], password_hash: 'x' });
    const res = await request(app).post('/api/auth/forgot-password').send(body);
    const raw = repo.insertPasswordResetToken.mock.calls[0][0].rawToken;
    expect(JSON.stringify(res.body)).not.toContain(raw);
    expect(JSON.stringify(res.headers)).not.toContain(raw);
  });

  test('reset-password with an invalid token → 400 INVALID_RESET_TOKEN; token not echoed', async () => {
    repo.resetPasswordWithToken.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: 'tok-SECRET-123', newPassword: 'Railway@Secure1!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
    expect(JSON.stringify(res.body)).not.toContain('tok-SECRET-123');
  });
});

describe('error handling', () => {
  test('malformed JSON body → 400 INVALID_JSON (not 500)', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('database failure → generic 500 with no internals', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    repo.findByEmail.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:5432 user=secret'), { code: 'ECONNREFUSED' }));
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    console.error.mockRestore();
  });
});

describe('seed data is the source of truth for permissions', () => {
  const seed = fs.readFileSync(path.join(__dirname, '../../../database/c1-identity/seed.sql'), 'utf8');

  test('MANAGE_USERS (used by the unlock route) is granted to ADMIN and nobody else', () => {
    const roles = [...seed.matchAll(/\(\s*'(CUSTOMER|STAFF|ADMIN)'\s*,\s*'MANAGE_USERS'\s*\)/g)].map((m) => m[1]);
    expect(roles).toEqual(['ADMIN']);
  });

  test('the fake PERMS table used above matches seed.sql for MANAGE_USERS / VIEW_PASSENGER', () => {
    for (const perm of ['MANAGE_USERS', 'VIEW_PASSENGER']) {
      const fromSeed = [...seed.matchAll(new RegExp(`\\(\\s*'(CUSTOMER|STAFF|ADMIN)'\\s*,\\s*'${perm}'\\s*\\)`, 'g'))].map((m) => m[1]).sort();
      const fromFake = Object.entries(PERMS).filter(([, ps]) => ps.includes(perm)).map(([r]) => r).sort();
      expect(fromFake).toEqual(fromSeed);
    }
  });
});
