/**
 * Configuration safety (D2 opt-in rules, D8 proxy parsing, secret strength)
 * and secret-leak checks in logs (D4).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const { parseTrustProxy } = require('../../src/config/trustProxy');

/** Load a fresh copy of config/env.js with the given env overrides. */
function loadEnv(overrides = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, overrides);
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k];
  try {
    let cfg;
    jest.isolateModules(() => {
      jest.doMock('dotenv', () => ({ config: jest.fn() }));
      cfg = require('../../src/config/env');
    });
    return cfg;
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

const STRONG = 'p'.repeat(64);

describe('parseTrustProxy (D8)', () => {
  test.each([undefined, '', '  ', 'false', 'FALSE', '0'])('%p → false (no proxy trusted)', (v) => {
    expect(parseTrustProxy(v)).toBe(false);
  });

  test('hop counts', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(() => parseTrustProxy('11')).toThrow(/hop count/);
  });

  test.each(['true', 'TRUE', '*', '0.0.0.0/0', '::/0'])('rejects blanket trust: %p', (v) => {
    expect(() => parseTrustProxy(v)).toThrow(/TRUST_PROXY/);
  });

  test('accepts explicit addresses, CIDRs and named subnets', () => {
    expect(parseTrustProxy('10.0.0.5, 10.0.1.0/24')).toEqual(['10.0.0.5', '10.0.1.0/24']);
    expect(parseTrustProxy('loopback')).toEqual(['loopback']);
    expect(parseTrustProxy('::1, fd00::/8')).toEqual(['::1', 'fd00::/8']);
  });

  test.each(['not-an-ip', '10.0.0.1/33', '10.0.0.1/x', '10.0.0.1/8/8', '999.1.1.1'])('rejects garbage %p', (v) => {
    expect(() => parseTrustProxy(v)).toThrow(/TRUST_PROXY/);
  });
});

describe('env.js (D2 opt-in, secret strength, proxy)', () => {
  test('defaults: reset-token exposure OFF and no proxy trusted', () => {
    const cfg = loadEnv({ NODE_ENV: 'development', JWT_SECRET: STRONG, DEV_EXPOSE_RESET_TOKEN: undefined, TRUST_PROXY: undefined });
    expect(cfg.devExposeResetToken).toBe(false);
    expect(cfg.trustProxy).toBe(false);
  });

  test('DEV_EXPOSE_RESET_TOKEN=true is accepted in development and test', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (const env of ['development', 'test']) {
      expect(loadEnv({ NODE_ENV: env, JWT_SECRET: STRONG, DEV_EXPOSE_RESET_TOKEN: 'true' }).devExposeResetToken).toBe(true);
    }
    console.warn.mockRestore();
  });

  test.each(['production', 'staging', 'prod'])('DEV_EXPOSE_RESET_TOKEN=true is REJECTED when NODE_ENV=%s', (env) => {
    expect(() => loadEnv({ NODE_ENV: env, JWT_SECRET: STRONG, DEV_EXPOSE_RESET_TOKEN: 'true' })).toThrow(/DEV_EXPOSE_RESET_TOKEN/);
  });

  test('non-boolean DEV_EXPOSE_RESET_TOKEN is rejected', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: STRONG, DEV_EXPOSE_RESET_TOKEN: 'yes' })).toThrow(/true.*false/);
  });

  test('missing JWT_SECRET fails startup', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });

  test('short JWT_SECRET fails startup everywhere; <64 chars fails in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) })).toThrow(/at least 64/);
    expect(loadEnv({ NODE_ENV: 'production', JWT_SECRET: STRONG }).isProd).toBe(true);
  });

  test('placeholder JWT_SECRET is refused in production', () => {
    // The placeholder must be >= 64 chars so the length check is bypassed and
    // the placeholder check is what actually triggers the error.
    const placeholder = 'REPLACE_WITH_A_STRONG_RANDOM_SECRET_AT_LEAST_64_CHARS_AND_PAD_!!';
    expect(placeholder.length).toBeGreaterThanOrEqual(64); // self-check
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: placeholder }))
      .toThrow(/placeholder/);
  });

  test('TRUST_PROXY=true is refused at startup', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: STRONG, TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
    expect(loadEnv({ NODE_ENV: 'development', JWT_SECRET: STRONG, TRUST_PROXY: '1' }).trustProxy).toBe(1);
  });
});

describe('D4 — no connection-string / secret leakage in logs', () => {
  const URI = 'mongodb://auditUser:S3cr3tPassw0rd@db.internal.example:27017/railway?authSource=admin&tls=true';
  const SECRETS = [/S3cr3tPassw0rd/, /auditUser/, /authSource/, /mongodb:\/\//i];

  function captureConsole() {
    const lines = [];
    const rec = (...a) => lines.push(a.map(String).join(' '));
    jest.spyOn(console, 'log').mockImplementation(rec);
    jest.spyOn(console, 'warn').mockImplementation(rec);
    jest.spyOn(console, 'error').mockImplementation(rec);
    return lines;
  }

  afterEach(() => jest.restoreAllMocks());

  test('safeTarget() drops credentials and options', () => {
    const { safeTarget } = loadMongo({ MONGO_URI: URI, connectBehaviour: 'ok' }).mongo;
    const out = safeTarget(URI);
    expect(out).toBe('db.internal.example:27017/railway');
    SECRETS.forEach((re) => expect(out).not.toMatch(re));
    expect(safeTarget('not a uri')).toBe('(configured MONGO_URI)');
  });

  function loadMongo({ MONGO_URI, connectBehaviour }) {
    let mongo;
    const saved = process.env.MONGO_URI;
    process.env.MONGO_URI = MONGO_URI;
    jest.isolateModules(() => {
      jest.doMock('mongodb', () => ({
        MongoClient: jest.fn().mockImplementation(() => ({
          connect: connectBehaviour === 'ok'
            ? jest.fn().mockResolvedValue()
            : jest.fn().mockRejectedValue(Object.assign(new Error(`failed for ${MONGO_URI}`), { name: 'MongoServerSelectionError' })),
          close: jest.fn().mockResolvedValue(),
          db: jest.fn().mockReturnValue({ collection: jest.fn() }),
        })),
      }));
      mongo = require('../../src/config/mongo');
    });
    process.env.MONGO_URI = saved;
    return { mongo };
  }

  test('successful connect logs host/db only', async () => {
    const lines = captureConsole();
    await loadMongo({ MONGO_URI: URI, connectBehaviour: 'ok' }).mongo.connect();
    expect(lines.join('\n')).toMatch(/Connected to db\.internal\.example:27017\/railway/);
    SECRETS.forEach((re) => expect(lines.join('\n')).not.toMatch(re));
  });

  test('failed connect throws a generic message without the driver text or credentials', async () => {
    const lines = captureConsole();
    const { mongo } = loadMongo({ MONGO_URI: URI, connectBehaviour: 'fail' });
    let err;
    await mongo.connect().catch((e) => { err = e; });
    expect(err).toBeDefined();
    expect(err.message).toMatch(/MongoServerSelectionError/);
    SECRETS.forEach((re) => {
      expect(err.message).not.toMatch(re);
      expect(lines.join('\n')).not.toMatch(re);
    });
  });

  test('static scan: no console call in src/ prints secrets, tokens or raw errors', () => {
    const files = [];
    (function walk(dir) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p);
      }
    })(path.join(__dirname, '../../src'));

    const FORBIDDEN = /config\.(mongoUri|jwtSecret|pg)\b|process\.env\.(MONGO_URI|JWT_SECRET|PGPASSWORD)|rawToken|rawRefresh|refreshToken|devToken|password_hash|passwordHash|newPassword|currentPassword|\.message\b|,\s*err\s*\)/;
    const offenders = [];
    for (const file of files) {
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (/console\.(log|warn|error|info|debug)\(/.test(line) && FORBIDDEN.test(line)) {
          offenders.push(`${path.relative(path.join(__dirname, '../..'), file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    // Permitted: credential-free Mongo wrapper in server.js (warn) and
    // mongo.js safeTarget log (log, contains no credentials).
    const real = offenders.filter((o) =>
      !/server\.js:\d+: console\.warn\('\[MONGO\]/.test(o) &&
      !/mongo\.js:\d+: console\.log\(`\[MONGO\] Connected to \$\{safeTarget/.test(o)
    );
    expect(real).toEqual([]);
  });
});
