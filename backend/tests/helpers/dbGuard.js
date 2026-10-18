/**
 * dbGuard.js — refuse to run database-backed tests against anything that is
 * not an explicitly disposable test database.
 *
 * Call assertDisposableTestDb() at the top of every DB test file, BEFORE any
 * query. The database name must end in "_test" (e.g. railway_test).
 */
'use strict';

function assertDisposableTestDb() {
  const name = process.env.PGDATABASE || '';
  if (!/_test$/.test(name)) {
    throw new Error(
      `Refusing to run DB tests: PGDATABASE "${name}" does not end in "_test". ` +
      'Create a dedicated database (e.g. railway_test) and set TEST_DB.'
    );
  }
  return name;
}

module.exports = { assertDisposableTestDb };
