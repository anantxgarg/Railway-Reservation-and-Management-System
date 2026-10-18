/**
 * trustProxy.js — Parse and validate the TRUST_PROXY environment variable.
 *
 * Express's `trust proxy` setting decides whether X-Forwarded-For is believed
 * when computing req.ip (which the rate limiter and audit log use). Blindly
 * trusting it lets any client spoof its IP and dodge rate limits, so this
 * parser ONLY accepts explicit, bounded topologies:
 *
 *   (unset) / "false" / "0"  → do not trust any proxy (default; req.ip is the socket peer)
 *   "1", "2", … (max 10)     → trust exactly that many proxy hops in front of the app
 *   "10.0.0.5, 10.0.0.0/24"  → trust only these addresses / CIDR ranges
 *   "loopback", "linklocal", "uniquelocal" → Express named subnets (may be combined)
 *
 * Rejected: "true", "*", and match-everything CIDRs (0.0.0.0/0, ::/0).
 */
'use strict';

const net = require('net');

const NAMED = new Set(['loopback', 'linklocal', 'uniquelocal']);
const MAX_HOPS = 10;

function fail(msg) {
  throw new Error(`[CONFIG] TRUST_PROXY ${msg}`);
}

function validateEntry(entry) {
  if (NAMED.has(entry.toLowerCase())) return entry.toLowerCase();

  const [addr, prefix, ...extra] = entry.split('/');
  const family = net.isIP(addr);
  if (!family || extra.length) fail(`contains an invalid entry: "${entry}"`);

  if (prefix !== undefined) {
    const bits = Number(prefix);
    const max  = family === 4 ? 32 : 128;
    if (!/^\d+$/.test(prefix) || bits > max) fail(`has an invalid CIDR prefix in "${entry}"`);
    if (bits === 0) fail('must not trust every address (a /0 range is not allowed)');
  }
  return entry;
}

/**
 * @param {string|undefined} raw
 * @returns {false|number|string[]} value suitable for app.set('trust proxy', value)
 */
function parseTrustProxy(raw) {
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim();
  if (!v || v.toLowerCase() === 'false') return false;

  if (v.toLowerCase() === 'true' || v === '*') {
    fail('must not be "true" or "*": trusting every proxy lets clients spoof their IP. ' +
         'Use a hop count (e.g. 1) or explicit proxy addresses.');
  }

  if (/^\d+$/.test(v)) {
    const hops = parseInt(v, 10);
    if (hops === 0) return false;
    if (hops > MAX_HOPS) fail(`hop count must be between 1 and ${MAX_HOPS}`);
    return hops;
  }

  const entries = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (!entries.length) fail('is empty');
  return entries.map(validateEntry);
}

module.exports = { parseTrustProxy };
