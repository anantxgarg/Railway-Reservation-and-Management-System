/**
 * Jest configuration — two projects:
 *
 *   unit — OFFLINE tests. No PostgreSQL / MongoDB required (everything that
 *          touches them is mocked). Run with:  npm test
 *
 *   db   — DATABASE-BACKED integration tests. Require a running PostgreSQL
 *          test database whose name ends in "_test" (enforced by
 *          tests/helpers/dbGuard.js). Run with:  npm run test:db
 *
 * Tests run serially to avoid DB state races between cases.
 */
module.exports = {
  maxWorkers: 1,
  verbose:    true,
  projects: [
    {
      displayName:     'unit',
      testEnvironment: 'node',
      testMatch:       ['<rootDir>/tests/unit/**/*.test.js'],
      setupFiles:      ['<rootDir>/tests/helpers/unitEnv.js'],
      testTimeout:     30000,
    },
    {
      displayName:     'db',
      testEnvironment: 'node',
      testMatch:       ['<rootDir>/tests/auth.test.js', '<rootDir>/tests/db/**/*.test.js'],
      setupFiles:      ['<rootDir>/tests/helpers/dbEnv.js'],
      testTimeout:     60000,
    },
  ],
};
