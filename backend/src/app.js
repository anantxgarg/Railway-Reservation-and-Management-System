/**
 * app.js — Express application factory.
 *
 * Creates and configures the Express app.
 * Does NOT start the HTTP server (that is server.js).
 * Exported for use in tests (supertest needs the app, not the server).
 */
'use strict';

const express   = require('express');
const cors      = require('cors');
const config    = require('./config/env');
const authRouter  = require('./routes/auth');
const adminRouter = require('./routes/admin');
const usersRouter = require('./routes/users');

const app = express();

// ── Reverse-proxy trust ───────────────────────────────────────────────────────────
// Default (TRUST_PROXY unset): X-Forwarded-For is IGNORED and req.ip is the
// socket peer, so clients cannot spoof their IP to evade rate limits.
// Set TRUST_PROXY to a hop count or explicit proxy addresses ONLY when the app
// really runs behind that proxy topology (validated in config/trustProxy.js).
app.set('trust proxy', config.trustProxy);

// ── Security / CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin:      config.corsOrigin,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Remove the X-Powered-By header
app.disable('x-powered-by');

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // reject suspiciously large bodies
app.use(express.urlencoded({ extended: false }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/users', usersRouter);

// ── Health check (no auth) ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
  }
  console.error('[APP] Unhandled error:', err.code || err.name);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

module.exports = app;
