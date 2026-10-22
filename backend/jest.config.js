
/**
 * Jest configuration — two projects:
 *
 * unit — OFFLINE tests. No PostgreSQL or MongoDB required.
 *        Run with: npm test
 *
 * db — DATABASE-BACKED integration tests.
 *      Require a dedicated, disposable PostgreSQL test database.
 *      Run with: npm run test:db
 *
 * Tests run serially to avoid database state races.
 */
module.exports = {
  maxWorkers: 1,
  verbose: true,
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/helpers/unitEnv.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/unitTimeout.js'],
    },
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/auth.test.js',
        '<rootDir>/tests/db/**/*.test.js',
      ],
      setupFiles: ['<rootDir>/tests/helpers/dbEnv.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/dbTimeout.js'],
    },
  ],
};
