/**
 * db.js — PostgreSQL connection pool (pg.Pool).
 *
 * Exposes a single pool instance shared across the application.
 * Use db.query(sql, params) for single statements and db.withTransaction(fn)
 * for multi-statement atomic work.
 *
 * Time handling (UTC policy):
 *   The C1 token tables use TIMESTAMP *without* time zone, so the stored value
 *   is a bare wall-clock reading. To make that independent of the machine
 *   timezones of Node and PostgreSQL, this app treats every such value as UTC:
 *     - each pooled session is opened with `timezone=UTC`;
 *     - token SQL additionally computes times as (now() AT TIME ZONE 'UTC')
 *       explicitly, so it stays correct even if the session option is dropped
 *       (e.g. by a pooler such as PgBouncer);
 *     - the pg type parser for `timestamp` (OID 1114) reads values as UTC
 *       instead of the Node process's local zone.
 *   No JS Date is ever sent to PostgreSQL for token expiry; TTLs are passed as
 *   seconds and added to the database clock.
 */
'use strict';

const { Pool, types } = require('pg');
const config          = require('./env');

const TIMESTAMP_OID = 1114; // timestamp WITHOUT time zone

/**
 * Parse a PostgreSQL `timestamp` text value ("2026-10-17 09:40:59.123456") as UTC.
 * @param {string|null} value
 * @returns {Date|null}
 */
function parseTimestampAsUtc(value) {
  if (value === null || value === undefined) return null;
  return new Date(String(value).replace(' ', 'T') + 'Z');
}

const poolTypes = {
  getTypeParser: (oid, format) =>
    oid === TIMESTAMP_OID ? parseTimestampAsUtc : types.getTypeParser(oid, format),
};

const pool = new Pool({
  ...config.pg,
  options: '-c timezone=UTC',
  types:   poolTypes,
});

// Surface connection errors immediately rather than on first query.
pool.on('error', (err) => {
  console.error('[DB] Unexpected idle-client error:', err.code || err.name);
});

/**
 * Execute a parameterised SQL statement.
 * @param {string}  sql    - SQL text with $1, $2, … placeholders
 * @param {Array}   [params] - Bound values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(sql, params) {
  return pool.query(sql, params);
}

/**
 * Acquire a client from the pool (needed for multi-statement transactions).
 * IMPORTANT: always call client.release() in a finally block.
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run `fn(client)` inside BEGIN/COMMIT. Any thrown error rolls the whole
 * transaction back and is re-thrown. The client is always released.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // Connection is probably broken; the original error is what matters.
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close all pool connections — used in tests and graceful shutdown.
 */
async function end() {
  return pool.end();
}

module.exports = { query, getClient, withTransaction, end, parseTimestampAsUtc };
