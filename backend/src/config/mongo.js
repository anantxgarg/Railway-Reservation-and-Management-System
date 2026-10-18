/**
 * mongo.js — MongoDB client for the audit_log collection.
 *
 * Follows the schema defined in database/c1-identity/mongo/audit_log.js.
 * The collection enforces $jsonSchema validation, so this module just
 * provides a typed helper rather than re-validating the document shape.
 *
 * Field rules (from schema_mongodb.dbml):
 *   audit_id     string  (UUID, unique)
 *   user_id      string | null  ← users.user_id as STRING, e.g. "5"
 *   action       UPPER_SNAKE_CASE string
 *   resource_type UPPER_SNAKE_CASE string
 *   resource_id  string | null
 *   timestamp    Date
 *   result       "SUCCESS" | "FAILURE"
 *   metadata     object  (never put tokens/hashes/passwords here)
 *   ip_address   string | null
 *   device_info  string | null
 *
 * Logging policy: the connection string may contain a username, password and
 * options, so it is NEVER logged. Only host:port/database (no credentials) and
 * error class names are written to the console.
 */
'use strict';

const { MongoClient } = require('mongodb');
const config          = require('./env');

let client = null;
let db     = null;

/**
 * Describe a Mongo URI without any credentials or query options.
 * Returns only "host[:port]/database", or a generic label if unparseable.
 * @param {string} uri
 * @returns {string}
 */
function safeTarget(uri) {
  try {
    const u = new URL(uri);
    const host = u.port ? `${u.hostname}:${u.port}` : u.hostname;
    return `${host}${u.pathname || ''}`;
  } catch (_e) {
    return '(configured MONGO_URI)';
  }
}

/**
 * Connect to MongoDB.  Called once at server startup.
 * Errors are re-thrown as a generic message (the driver's own message can
 * echo connection details).
 */
async function connect() {
  if (client) return; // already connected
  const candidate = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await candidate.connect();
  } catch (err) {
    try { await candidate.close(); } catch (_e) { /* ignore */ }
    throw new Error(`[MONGO] Connection to ${safeTarget(config.mongoUri)} failed (${err.name || 'Error'})`);
  }
  client = candidate;
  db     = client.db(); // database name is part of MONGO_URI
  console.log(`[MONGO] Connected to ${safeTarget(config.mongoUri)}`);
}

/**
 * Return the raw MongoDB Db instance.
 * @returns {import('mongodb').Db}
 */
function getDb() {
  if (!db) throw new Error('[MONGO] Not connected. Call connect() first.');
  return db;
}

/**
 * Return the audit_log collection.
 * @returns {import('mongodb').Collection}
 */
function auditCollection() {
  return getDb().collection('audit_log');
}

/**
 * Close the connection.  Used in tests and graceful shutdown.
 */
async function close() {
  if (client) {
    await client.close();
    client = null;
    db     = null;
  }
}

module.exports = { connect, getDb, auditCollection, close, safeTarget };
