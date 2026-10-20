/**
 * dbEnv.js — environment for DATABASE-BACKED tests.
 *
 * Database credentials come from the real environment / backend/.env
 * (nothing is hard-coded). Only the database NAME is forced: TEST_DB, default
 * "railway_test". The suite then refuses to run unless that name ends in
 * "_test" (see dbGuard.js), so it can never touch a dev/shared/prod database.
 *
 * DEV_EXPOSE_RESET_TOKEN is enabled here (allowed because NODE_ENV=test) so the
 * reset flow can be exercised without an e-mail service.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

process.env.NODE_ENV   = 'test';
process.env.PGDATABASE = process.env.TEST_DB || 'railway_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 64
  ? process.env.JWT_SECRET
  : 'db_test_jwt_secret_db_test_jwt_secret_db_test_jwt_secret_0123456789abcdef';
process.env.JWT_EXPIRES_IN           = '15m';
process.env.LOGIN_LOCKOUT_THRESHOLD  = '3';
process.env.DEV_EXPOSE_RESET_TOKEN   = 'true';
process.env.RATE_LIMIT_MAX_AUTH      = '100000';
process.env.RATE_LIMIT_MAX_REFRESH   = '100000';
process.env.RATE_LIMIT_MAX_RESET     = '100000';
process.env.PGHOST   = process.env.PGHOST   || 'localhost';
process.env.PGPORT   = process.env.PGPORT   || '5432';
process.env.PGUSER   = process.env.PGUSER   || 'postgres';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/railway_test';
delete process.env.TRUST_PROXY;
process.env.BREVO_API_KEY = '';
