/**
 * server.js — HTTP server entry point.
 *
 * 1. Loads environment config (validates required vars — fails fast if missing).
 * 2. Connects to MongoDB for audit logging.
 * 3. Starts the Express HTTP server.
 * 4. Registers graceful-shutdown handlers.
 *
 * PostgreSQL is connected lazily by pg.Pool on first query, so no explicit
 * connection step is needed here — the pool validates on startup via the
 * test query below.
 */
'use strict';

const config = require('./config/env');
const mongo  = require('./config/mongo');
const db     = require('./config/db');
const app    = require('./app');

async function start() {
  // ── Verify PostgreSQL connectivity ─────────────────────────────────────────
  try {
    await db.query('SELECT 1');
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.error('[DB] Cannot connect to PostgreSQL:', err.code || err.name);
    process.exit(1);
  }

  // ── Connect to MongoDB (audit log) ─────────────────────────────────────────
  try {
    await mongo.connect();
  } catch (err) {
    // MongoDB is used only for audit logs. If it is unavailable at startup,
    // log a warning but continue — audit failures are non-fatal per project policy.
    // err.message comes from config/mongo.js and contains no credentials.
    console.warn('[MONGO] MongoDB unavailable at startup; audit logging degraded:', err.message);
  }

  // ── Start HTTP server ───────────────────────────────────────────────────────
  const server = app.listen(config.port, () => {
    console.log(`[SERVER] Railway Auth API running on port ${config.port} [${config.nodeEnv}]`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  async function shutdown(signal) {
    console.log(`[SERVER] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await db.end();
      await mongo.close();
      console.log('[SERVER] Closed all connections. Exiting.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[SERVER] Fatal startup error:', err.code || err.name);
  process.exit(1);
});
