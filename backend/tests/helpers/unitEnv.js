/**
 * unitEnv.js — environment for OFFLINE unit tests.
 *
 * Forces dummy, non-secret values so the unit suite never reads a developer's
 * real .env credentials and never needs PostgreSQL or MongoDB (dotenv does not
 * override variables that are already set). Rate limits are set high so tests
 * that are not about rate limiting never trip them.
 */
Object.assign(process.env, {
  NODE_ENV:      'test',
  PGHOST:        'localhost',
  PGPORT:        '1',            // closed port: any accidental DB access fails fast
  PGDATABASE:    'unit_dummy_db',
  PGUSER:        'unit_dummy_user',
  PGPASSWORD:    'unit_dummy_password',
  MONGO_URI:     'mongodb://localhost:1/unit_dummy_audit',
  JWT_SECRET:    'unit_test_jwt_secret_unit_test_jwt_secret_unit_test_jwt_secret_0123456789',
  JWT_EXPIRES_IN: '15m',
  LOGIN_LOCKOUT_THRESHOLD: '3',
  RATE_LIMIT_MAX_AUTH:    '100000',
  RATE_LIMIT_MAX_REFRESH: '100000',
  RATE_LIMIT_MAX_RESET:   '100000',
  BREVO_API_KEY:          '',
});
delete process.env.TRUST_PROXY;
delete process.env.DEV_EXPOSE_RESET_TOKEN;
