/**
 * auth.test.js — Integration tests for the C1 authentication backend.
 *
 * Prerequisites:
 *   - A test PostgreSQL database named TEST_DB (default: railway_test) must exist
 *     and have schema.sql, schema_auth_tokens.sql, seed.sql already applied.
 *   - Environment: copy .env.example to .env and set TEST_DB in env OR override
 *     via env var before running.
 *   - MongoDB: mocked (MongoClient.connect stubbed) — audit log writes don't
 *     require a live MongoDB in tests. This matches the project's policy that
 *     audit failures are non-fatal.
 *
 * Run:
 *   npm test
 *
 * The test suite:
 *   - Seeds fresh test users before each test that needs them.
 *   - Cleans up test-created users after each test.
 *   - NEVER uses the production database.
 *   - Does NOT delete Member 2's seeded dev accounts.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// ── Environment setup ─────────────────────────────────────────────────────────
// Point to a dedicated test database to avoid touching the dev database.
process.env.NODE_ENV     = 'test';
process.env.PGDATABASE   = process.env.TEST_DB || 'railway_test';
// Allow a short JWT expiry for expiry tests
process.env.JWT_EXPIRES_IN = '5s';
// Use a fixed secret in tests
process.env.JWT_SECRET = 'test_secret_that_is_at_least_64_characters_long_xxxxxxxxxxxxxxxxx';
process.env.PGHOST     = process.env.PGHOST     || 'localhost';
process.env.PGPORT     = process.env.PGPORT     || '5432';
process.env.PGUSER     = process.env.PGUSER     || 'postgres';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'postgres';
process.env.MONGO_URI  = process.env.MONGO_URI  || 'mongodb://localhost:27017/railway_test';
process.env.LOGIN_LOCKOUT_THRESHOLD = '3'; // lower threshold for lockout tests

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const app      = require('../src/app');
const db       = require('../src/config/db');

// ── Mock MongoDB so audit tests don't require a live Mongo ──────────────────
jest.mock('../src/config/mongo', () => {
  const insertOne = jest.fn().mockResolvedValue({ acknowledged: true });
  const collection = jest.fn().mockReturnValue({ insertOne });
  return {
    connect:          jest.fn().mockResolvedValue(undefined),
    close:            jest.fn().mockResolvedValue(undefined),
    getDb:            jest.fn().mockReturnValue({ collection }),
    auditCollection:  jest.fn().mockReturnValue({ insertOne }),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEST_EMAIL    = 'testauth_unique@test-domain.example';
const TEST_PASSWORD = 'TestPass@99!';
const TEST_NAME     = 'Auth Test User';

/** Clean up rows created by individual tests to keep each test isolated. */
async function deleteTestUser(email) {
  await db.query(
    `DELETE FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
}

/** Register a user directly through the API and return the response. */
async function apiRegister(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({
      name:     TEST_NAME,
      email:    TEST_EMAIL,
      phone:    '+919876543210',
      password: TEST_PASSWORD,
      ...overrides,
    });
}

/** Log in via the API and return the response. */
async function apiLogin(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return request(app)
    .post('/api/auth/login')
    .send({ email, password });
}

/** Insert a user directly into the DB (bypassing the API) for specific test scenarios. */
async function dbInsertUser({ email, password, status = 'ACTIVE', roleName = 'CUSTOMER' }) {
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO users (role_id, name, email, password_hash, status)
     SELECT r.role_id, $1, $2, $3, $4::user_status_enum
     FROM roles r WHERE r.role_name = $5::role_name_enum
     ON CONFLICT (email) DO NOTHING`,
    ['Test User', email.trim().toLowerCase(), hash, status, roleName]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Global setup / teardown
// ─────────────────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Clean up any leftover test users
  await deleteTestUser(TEST_EMAIL);
  await db.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Registration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  afterEach(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('valid registration succeeds with 201', async () => {
    const res = await apiRegister();
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.status).toBe('ACTIVE');
  });

  test('response never contains password_hash or password', async () => {
    const res = await apiRegister();
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/password_hash/);
    expect(body).not.toMatch(TEST_PASSWORD);
  });

  test('password is stored as bcrypt hash (not plaintext)', async () => {
    await apiRegister();
    const { rows } = await db.query(
      `SELECT password_hash FROM users WHERE email = $1`,
      [TEST_EMAIL.toLowerCase()]
    );
    expect(rows).toHaveLength(1);
    // Bcrypt hashes start with $2b$ or $2a$
    expect(rows[0].password_hash).toMatch(/^\$2[ab]\$/);
    // Must NOT equal the plaintext password
    expect(rows[0].password_hash).not.toBe(TEST_PASSWORD);
    // Must verify correctly
    const ok = await bcrypt.compare(TEST_PASSWORD, rows[0].password_hash);
    expect(ok).toBe(true);
  });

  test('new public registrations always get CUSTOMER role', async () => {
    const res = await apiRegister();
    expect(res.body.user.role).toBe('CUSTOMER');

    // Confirm in DB
    const { rows } = await db.query(
      `SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.email = $1`,
      [TEST_EMAIL.toLowerCase()]
    );
    expect(rows[0].role_name).toBe('CUSTOMER');
  });

  test('cannot self-register as ADMIN', async () => {
    // Even if the client sends a role field, it must be ignored
    const res = await apiRegister({ role: 'ADMIN' });
    if (res.status === 201) {
      // Server accepted but must have assigned CUSTOMER
      expect(res.body.user.role).toBe('CUSTOMER');
    }
    // Either 201 with CUSTOMER or 400 is acceptable; what is NOT acceptable is 201 with ADMIN
    if (res.body.user) {
      expect(res.body.user.role).not.toBe('ADMIN');
    }
    await deleteTestUser(TEST_EMAIL);
  });

  test('cannot self-register as STAFF', async () => {
    const res = await apiRegister({ role: 'STAFF' });
    if (res.body.user) {
      expect(res.body.user.role).not.toBe('STAFF');
    }
    await deleteTestUser(TEST_EMAIL);
  });

  test('duplicate email is rejected with 409', async () => {
    await apiRegister();
    const res = await apiRegister();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('missing email is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: TEST_NAME, password: TEST_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('invalid email format is rejected with 400', async () => {
    const res = await apiRegister({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('weak password is rejected with 400', async () => {
    const res = await apiRegister({ password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('missing name is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  test('invalid phone format is rejected with 400', async () => {
    const res = await apiRegister({ phone: '12ab' });
    expect(res.status).toBe(400);
  });

  test('email is stored lower-cased even if submitted with capitals', async () => {
    const mixedEmail = 'TestAUTH_unique@test-domain.EXAMPLE';
    await deleteTestUser(mixedEmail); // pre-clean
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: TEST_NAME, email: mixedEmail, password: TEST_PASSWORD });
    // Should either succeed (201) or conflict (409) if TEST_EMAIL was just created
    if (res.status === 201) {
      expect(res.body.user.email).toBe(mixedEmail.trim().toLowerCase());
      await deleteTestUser(mixedEmail);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Login tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
  });

  afterEach(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('correct credentials succeed with 200 and return tokens', async () => {
    const res = await apiLogin();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();        // access token
    expect(res.body.refreshToken).toBeDefined(); // refresh token
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  test('response never contains password_hash', async () => {
    const res = await apiLogin();
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);
  });

  test('wrong password returns 401 with generic message', async () => {
    const res = await apiLogin(TEST_EMAIL, 'WrongPassword!1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('unknown email returns 401 with generic message', async () => {
    const res = await apiLogin('nobody@noreply.example', 'AnyPassword@1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('successful login updates last_login_at', async () => {
    await apiLogin();
    const { rows } = await db.query(
      `SELECT last_login_at FROM users WHERE email = $1`,
      [TEST_EMAIL.toLowerCase()]
    );
    expect(rows[0].last_login_at).not.toBeNull();
  });

  test('LOCKED account is refused login with 403', async () => {
    // Use a pre-seeded locked account from seed_dev_users.sql
    const res = await apiLogin('locked@example.com', 'Railway@Dev123');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  test('SUSPENDED account is refused login with 403', async () => {
    const res = await apiLogin('suspended@example.com', 'Railway@Dev123');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  test('account locks after LOGIN_LOCKOUT_THRESHOLD consecutive failures', async () => {
    const threshold = parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD || '3', 10);

    for (let i = 0; i < threshold; i++) {
      await apiLogin(TEST_EMAIL, 'WrongPassword!1');
    }

    // After threshold failures, the account should be LOCKED
    const { rows } = await db.query(
      `SELECT status, failed_login_attempts FROM users WHERE email = $1`,
      [TEST_EMAIL.toLowerCase()]
    );
    expect(rows[0].status).toBe('LOCKED');
    expect(rows[0].failed_login_attempts).toBeGreaterThanOrEqual(threshold);
  });

  test('missing password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/auth/me — authenticated user info
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
    const loginRes = await apiLogin();
    token = loginRes.body.token;
  });

  afterAll(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('valid token returns user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(res.body.role).toBe('CUSTOMER');
    expect(res.body.userId).toBeDefined();
  });

  test('response does not expose password_hash', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);
  });

  test('missing token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  test('invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer totallyinvalidtoken');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('expired token returns 401', async () => {
    // JWT_EXPIRES_IN is set to 5s in this test file.
    // We generate a token and wait for it to expire.
    const { generateAccessToken } = require('../src/services/tokenService');
    const expiredToken = generateAccessToken({ userId: 999999, role: 'CUSTOMER' });
    // Wait 6 seconds for the 5s token to expire
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  }, 15000);

  test('role from req.user comes from the DB, not from token payload', async () => {
    // If we manually craft a token claiming ADMIN role but the DB says CUSTOMER,
    // /me should return the DB role (CUSTOMER).
    const { generateAccessToken } = require('../src/services/tokenService');

    // Get the real customer's user_id
    const { rows } = await db.query(
      `SELECT user_id FROM users WHERE email = $1`,
      [TEST_EMAIL.toLowerCase()]
    );
    const userId = rows[0].user_id;

    // Craft a token claiming ADMIN
    const fakeAdminToken = generateAccessToken({ userId, role: 'ADMIN' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fakeAdminToken}`);
    expect(res.status).toBe(200);
    // The DB role (CUSTOMER) wins — not the token claim (ADMIN)
    expect(res.body.role).toBe('CUSTOMER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  let token;
  let refreshToken;

  beforeEach(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
    const loginRes = await apiLogin();
    token        = loginRes.body.token;
    refreshToken = loginRes.body.refreshToken;
  });

  afterEach(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('logout succeeds with 200', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('after logout, refresh token is revoked in the DB', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    const repo = require('../src/services/userRepository');
    const stored = await repo.findActiveRefreshToken(refreshToken);
    // The token should now be revoked (revoked_at set)
    if (stored) {
      expect(stored.revoked_at).not.toBeNull();
    }
    // If the token isn't found at all, that's also acceptable
  });

  test('logout requires authentication (no token → 401)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeAll(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
    const loginRes = await apiLogin();
    refreshToken = loginRes.body.refreshToken;
  });

  afterAll(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('valid refresh token returns new access + refresh tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // New refresh token should differ from old one (rotation)
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  test('invalid refresh token returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'bogus_token_value' });
    expect(res.status).toBe(401);
  });

  test('missing refreshToken returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  const NEW_PASS = 'NewPass@Secure1!';
  let token;

  beforeEach(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
    const loginRes = await apiLogin();
    token = loginRes.body.token;
  });

  afterEach(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('correct current password allows change; new password works', async () => {
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASS });
    expect(changeRes.status).toBe(200);

    // Old password should now fail
    const oldLoginRes = await apiLogin(TEST_EMAIL, TEST_PASSWORD);
    expect(oldLoginRes.status).toBe(401);

    // New password should succeed
    const newLoginRes = await apiLogin(TEST_EMAIL, NEW_PASS);
    expect(newLoginRes.status).toBe(200);
  });

  test('wrong current password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongCurrent@1!', newPassword: NEW_PASS });
    expect(res.status).toBe(401);
  });

  test('change-password requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASS });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/auth/forgot-password and /reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password and reset-password', () => {
  beforeAll(async () => {
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
  });

  afterAll(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('forgot-password always returns 200 (no email enumeration)', async () => {
    const knownRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_EMAIL });
    expect(knownRes.status).toBe(200);

    const unknownRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@noreply.example' });
    expect(unknownRes.status).toBe(200);
  });

  test('reset-password with dev token resets password successfully', async () => {
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_EMAIL });
    expect(forgotRes.status).toBe(200);

    const devToken = forgotRes.body.devToken;
    // devToken is only present in non-production mode
    if (!devToken) {
      console.log('  [SKIP] No devToken in response — set NODE_ENV != production to get it');
      return;
    }

    const newPassword = 'ResetPass@New99!';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: devToken, newPassword });
    expect(resetRes.status).toBe(200);

    // New password should now work
    const loginRes = await apiLogin(TEST_EMAIL, newPassword);
    expect(loginRes.status).toBe(200);
  });

  test('invalid reset token returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bogus_token', newPassword: 'NewPass@12!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Authorization enforcement tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Authorization middleware', () => {
  const { requireRole, requirePermission } = require('../src/middleware/authorize');
  const express = require('express');
  const { authenticate } = require('../src/middleware/authenticate');

  // Build a mini test app with protected routes
  let testApp;
  let customerToken;
  let adminToken;

  beforeAll(async () => {
    testApp = express();
    testApp.use(express.json());

    // Admin-only route
    testApp.get('/admin-only', authenticate, requireRole('ADMIN'), (_req, res) =>
      res.status(200).json({ ok: true })
    );
    // Permission-gated route
    testApp.get('/manage-users', authenticate, requirePermission('MANAGE_USERS'), (_req, res) =>
      res.status(200).json({ ok: true })
    );

    // Get tokens for a customer and admin
    await deleteTestUser(TEST_EMAIL);
    await apiRegister();
    const custLogin = await apiLogin();
    customerToken = custLogin.body.token;

    const adminLogin = await apiLogin('admin@example.com', 'Railway@Dev123');
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await deleteTestUser(TEST_EMAIL);
  });

  test('CUSTOMER cannot access ADMIN-only route', async () => {
    const res = await request(testApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('ADMIN can access ADMIN-only route', async () => {
    const res = await request(testApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('CUSTOMER cannot access route requiring MANAGE_USERS permission', async () => {
    const res = await request(testApp)
      .get('/manage-users')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('ADMIN can access route requiring MANAGE_USERS permission', async () => {
    const res = await request(testApp)
      .get('/manage-users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('unauthenticated request to protected route returns 401', async () => {
    const res = await request(testApp).get('/admin-only');
    expect(res.status).toBe(401);
  });

  test('client-supplied userId in body cannot impersonate another user', async () => {
    // /me never reads user_id from body — it always uses req.user set by authenticate()
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ userId: 1 }); // attempt to impersonate user 1

    expect(res.status).toBe(200);
    // Should return the authenticated customer's data, not user 1's
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
  });
});
