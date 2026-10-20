/**
 * Repository transaction structure (OFFLINE, config/db mocked).
 *
 * These tests prove the SHAPE of the atomic flows — which statements run, in
 * what order, with which guards, and that a failure triggers ROLLBACK. They do
 * NOT prove PostgreSQL's locking behaviour; real concurrency is covered by
 * tests/auth.test.js and tests/db/atomicity.db.test.js (need PostgreSQL).
 */
'use strict';

const mockPoolQuery = jest.fn();
const mockLog       = [];          // every statement on a transaction client + BEGIN/COMMIT/ROLLBACK
let   mockClientHandler = null;    // (sql, params) => result, set per test

jest.mock('../../src/config/db', () => ({
  query: (...a) => mockPoolQuery(...a),
  withTransaction: async (fn) => {
    mockLog.push({ sql: 'BEGIN' });
    const client = {
      query: async (sql, params) => {
        mockLog.push({ sql, params });
        return mockClientHandler(sql, params);
      },
    };
    try {
      const out = await fn(client);
      mockLog.push({ sql: 'COMMIT' });
      return out;
    } catch (e) {
      mockLog.push({ sql: 'ROLLBACK' });
      throw e;
    }
  },
}));

const repo = require('../../src/services/userRepository');

const sqls  = () => mockLog.map((l) => l.sql.replace(/\s+/g, ' ').trim());
const has   = (re) => sqls().some((s) => re.test(s));
const index = (re) => sqls().findIndex((s) => re.test(s));
const R = (rows = [], rowCount = rows.length) => ({ rows, rowCount });

beforeEach(() => {
  mockLog.length = 0;
  mockPoolQuery.mockReset();
  mockClientHandler = () => R();
});

describe('D1 — incrementFailedLogin only ever touches ACTIVE accounts', () => {
  test('UPDATE is restricted to status = ACTIVE and only sets LOCKED from the counter', async () => {
    mockPoolQuery.mockResolvedValue(R([{ failed_login_attempts: 3, status: 'LOCKED' }]));
    const out = await repo.incrementFailedLogin(5, 3);
    const [sql, params] = mockPoolQuery.mock.calls[0];
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toMatch(/WHERE user_id = \$1 AND status = 'ACTIVE'/);
    expect(flat).toMatch(/failed_login_attempts \+ 1 >= \$2::int THEN 'LOCKED'::user_status_enum ELSE status/);
    expect(params).toEqual([5, 3]);
    expect(out).toEqual({ counted: true, newCount: 3, wasLocked: true });
  });

  test('below threshold: counted but not locked', async () => {
    mockPoolQuery.mockResolvedValue(R([{ failed_login_attempts: 1, status: 'ACTIVE' }]));
    expect(await repo.incrementFailedLogin(5, 3)).toEqual({ counted: true, newCount: 1, wasLocked: false });
  });

  test('non-ACTIVE account (0 rows matched): reports counted=false, wasLocked=false', async () => {
    mockPoolQuery.mockResolvedValue(R([]));
    expect(await repo.incrementFailedLogin(5, 3)).toEqual({ counted: false, newCount: null, wasLocked: false });
  });

  test('recordSuccessfulLogin only matches ACTIVE and reports whether it did', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await repo.recordSuccessfulLogin(5)).toBe(true);
    expect(mockPoolQuery.mock.calls[0][0]).toMatch(/status = 'ACTIVE'/);
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await repo.recordSuccessfulLogin(5)).toBe(false);
  });

  test('unlockUser changes LOCKED only; SUSPENDED/INACTIVE are reported, never modified', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await repo.unlockUser(5)).toEqual({ result: 'UNLOCKED' });
    expect(mockPoolQuery.mock.calls[0][0].replace(/\s+/g, ' ')).toMatch(/WHERE user_id = \$1 AND status = 'LOCKED'/);

    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 })
                 .mockResolvedValueOnce(R([{ user_id: 5, status: 'SUSPENDED' }]));
    expect(await repo.unlockUser(5)).toEqual({ result: 'NOT_LOCKED', status: 'SUSPENDED' });

    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce(R([]));
    expect(await repo.unlockUser(5)).toEqual({ result: 'NOT_FOUND' });
  });
});

describe('D5 — resetPasswordWithToken is one atomic transaction', () => {
  const HASHARG = { rawToken: 'raw-token', newPasswordHash: '$2b$12$' + 'a'.repeat(53) };

  test('success: claim → password → cleanup → revoke sessions → COMMIT, token stored only as sha256', async () => {
    mockClientHandler = (sql) => (/RETURNING user_id/.test(sql) ? R([{ user_id: 9 }]) : R([], 1));
    expect(await repo.resetPasswordWithToken(HASHARG)).toBe(9);

    const order = ['BEGIN', /UPDATE password_reset_tokens SET used_at/, /UPDATE users SET password_hash/, /UPDATE refresh_tokens SET revoked_at/, 'COMMIT'];
    let last = -1;
    for (const o of order) {
      const i = typeof o === 'string' ? sqls().indexOf(o) : index(o);
      expect(i).toBeGreaterThan(last);
      last = i;
    }
    const norm = (l) => l.sql.replace(/\s+/g, ' ').trim();
    const claim = mockLog.find((l) => /UPDATE password_reset_tokens SET used_at/.test(norm(l)));
    expect(norm(claim)).toMatch(/WHERE token_hash = \$1 AND used_at IS NULL AND expires_at > \(now\(\) AT TIME ZONE 'UTC'\)/);
    expect(claim.params).toEqual([repo.sha256hex('raw-token')]);
    expect(JSON.stringify(mockLog)).not.toContain('"raw-token"');
  });

  test.each([
    ['unknown / expired / already-used token (claim matches 0 rows)'],
  ])('%s → null, password never touched', async () => {
    mockClientHandler = () => R([], 0);
    expect(await repo.resetPasswordWithToken(HASHARG)).toBeNull();
    expect(has(/UPDATE users/)).toBe(false);
    expect(sqls()).toContain('ROLLBACK');
    expect(sqls()).not.toContain('COMMIT');
  });

  test('claimed token but account not ACTIVE → ROLLBACK undoes the claim (token NOT burned)', async () => {
    mockClientHandler = (sql) => {
      if (/UPDATE password_reset_tokens\s+SET used_at/.test(sql) && /RETURNING/.test(sql)) return R([{ user_id: 9 }]);
      if (/UPDATE users/.test(sql)) return R([], 0);
      return R([], 0);
    };
    expect(await repo.resetPasswordWithToken(HASHARG)).toBeNull();
    // The UPDATE users ... WHERE status = 'ACTIVE' must have been attempted (proves guard ran)
    expect(sqls().some((s) => s.startsWith('UPDATE users') && s.includes("status = 'ACTIVE'"))).toBe(true);
    expect(sqls()[sqls().length - 1]).toBe('ROLLBACK');
    expect(sqls()).not.toContain('COMMIT');
    expect(has(/UPDATE refresh_tokens/)).toBe(false);
  });

  test('a database error mid-transaction rolls back and propagates (never swallowed as "invalid token")', async () => {
    mockClientHandler = (sql) => {
      if (/RETURNING user_id/.test(sql)) return R([{ user_id: 9 }]);
      if (/UPDATE users/.test(sql)) throw Object.assign(new Error('db down'), { code: '57P01' });
      return R([], 1);
    };
    await expect(repo.resetPasswordWithToken(HASHARG)).rejects.toMatchObject({ code: '57P01' });
    expect(sqls()[sqls().length - 1]).toBe('ROLLBACK');
  });

  test('changePasswordAndRevokeSessions: update + revoke in one transaction; rollback if not ACTIVE', async () => {
    mockClientHandler = () => R([], 1);
    expect(await repo.changePasswordAndRevokeSessions(9, 'h')).toBe(true);
    expect(sqls()).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
    expect(has(/UPDATE refresh_tokens/)).toBe(true);

    mockLog.length = 0;
    mockClientHandler = () => R([], 0);
    expect(await repo.changePasswordAndRevokeSessions(9, 'h')).toBe(false);
    expect(sqls()).toContain('ROLLBACK');
    expect(has(/UPDATE refresh_tokens/)).toBe(false);
  });
});

describe('D5 — rotateRefreshToken is one atomic transaction with reuse detection', () => {
  const P = { rawOldToken: 'old', rawNewToken: 'new', ttlSeconds: 604800 };
  const row = (over = {}) => ({
    token_id: 1, user_id: 9, revoked_at: null, replaced_by: null,
    expired: false, status: 'ACTIVE', role_name: 'CUSTOMER', ...over,
  });
  const handler = (selectRow) => (sql) => {
    if (/FROM refresh_tokens rt/.test(sql)) return selectRow ? R([selectRow]) : R([]);
    if (/INSERT INTO refresh_tokens/.test(sql)) return R([{ token_id: 2 }]);
    return R([], 1);
  };

  test('success: row-locks the token, inserts the successor, revokes the old one with replaced_by, COMMIT', async () => {
    mockClientHandler = handler(row());
    expect(await repo.rotateRefreshToken(P)).toEqual({ ok: true, userId: 9, role: 'CUSTOMER' });

    expect(has(/FOR UPDATE OF rt/)).toBe(true);
    expect(index(/FOR UPDATE OF rt/)).toBeLessThan(index(/INSERT INTO refresh_tokens/));
    const normR = (l) => l.sql.replace(/\s+/g, ' ').trim();
    const upd = mockLog.find((l) => /UPDATE refresh_tokens SET revoked_at/.test(normR(l)));
    expect(normR(upd)).toMatch(/replaced_by = \$2/);
    expect(upd.params).toEqual([1, 2]);
    expect(sqls()).toContain('COMMIT');

    const sel = mockLog.find((l) => /FOR UPDATE OF rt/.test(l.sql));
    expect(sel.params).toEqual([repo.sha256hex('old')]);
    const ins = mockLog.find((l) => /INSERT INTO refresh_tokens/.test(l.sql));
    expect(ins.params).toEqual([9, repo.sha256hex('new'), 604800]); // hash + TTL seconds, no JS Date
  });

  test('unknown token → NOT_FOUND, nothing written', async () => {
    mockClientHandler = handler(null);
    expect(await repo.rotateRefreshToken(P)).toEqual({ ok: false, reason: 'NOT_FOUND' });
    // Use word-boundary check so 'FOR UPDATE OF rt' in the SELECT doesn't false-positive
    expect(has(/^\s*(INSERT|UPDATE)\s/)).toBe(false);
  });

  test('expired token → EXPIRED, no successor issued', async () => {
    mockClientHandler = handler(row({ expired: true }));
    expect(await repo.rotateRefreshToken(P)).toMatchObject({ ok: false, reason: 'EXPIRED' });
    expect(has(/INSERT INTO refresh_tokens/)).toBe(false);
  });

  test('token revoked by logout (no successor) → REVOKED, family NOT revoked', async () => {
    mockClientHandler = handler(row({ revoked_at: new Date(), replaced_by: null }));
    expect(await repo.rotateRefreshToken(P)).toMatchObject({ ok: false, reason: 'REVOKED' });
    expect(has(/UPDATE refresh_tokens/)).toBe(false);
    expect(has(/INSERT/)).toBe(false);
  });

  test('REUSE: rotated-away token replayed → whole family revoked and that revocation is COMMITTED', async () => {
    mockClientHandler = handler(row({ revoked_at: new Date(), replaced_by: 2 }));
    expect(await repo.rotateRefreshToken(P)).toEqual({ ok: false, reason: 'REUSED', userId: 9 });
    const fam = mockLog.find((l) => /UPDATE refresh_tokens SET revoked_at/.test(l.sql));
    expect(fam.sql.replace(/\s+/g, ' ')).toMatch(/WHERE user_id = \$1 AND revoked_at IS NULL/);
    expect(fam.params).toEqual([9]);
    expect(has(/INSERT/)).toBe(false);
    expect(sqls()).toContain('COMMIT');
  });

  test('inactive account (suspended since issue) → INACTIVE, no successor', async () => {
    mockClientHandler = handler(row({ status: 'SUSPENDED' }));
    expect(await repo.rotateRefreshToken(P)).toMatchObject({ ok: false, reason: 'INACTIVE' });
    expect(has(/INSERT INTO refresh_tokens/)).toBe(false);
  });

  test('failure while inserting the successor rolls everything back — old token stays valid, no half state', async () => {
    mockClientHandler = (sql) => {
      if (/FROM refresh_tokens rt/.test(sql)) return R([row()]);
      if (/INSERT INTO refresh_tokens/.test(sql)) throw new Error('insert failed');
      return R([], 1);
    };
    await expect(repo.rotateRefreshToken(P)).rejects.toThrow('insert failed');
    expect(sqls()[sqls().length - 1]).toBe('ROLLBACK');
    expect(has(/UPDATE refresh_tokens SET revoked_at/)).toBe(false);
  });
});

describe('D6 — UTC-explicit time handling', () => {
  test('every statement touching token tables computes time as (now() AT TIME ZONE \'UTC\') and never passes a JS Date', async () => {
    mockClientHandler = (sql) => {
      if (/FROM refresh_tokens rt/.test(sql)) return R([{ token_id: 1, user_id: 9, revoked_at: null, replaced_by: null, expired: false, status: 'ACTIVE', role_name: 'CUSTOMER' }]);
      if (/RETURNING token_id/.test(sql)) return R([{ token_id: 2 }]);
      if (/RETURNING reset_id/.test(sql)) return R([{ reset_id: 3 }]);
      if (/RETURNING user_id/.test(sql)) return R([{ user_id: 9 }]);
      return R([], 1);
    };
    mockPoolQuery.mockResolvedValue(R([{ token_id: 4 }]));

    await repo.insertRefreshToken({ userId: 9, rawToken: 'a', ttlSeconds: 60 });
    await repo.rotateRefreshToken({ rawOldToken: 'o', rawNewToken: 'n', ttlSeconds: 60 });
    await repo.insertPasswordResetToken({ userId: 9, rawToken: 'r', ttlSeconds: 60 });
    await repo.resetPasswordWithToken({ rawToken: 'r', newPasswordHash: 'h' });
    await repo.revokeAllUserRefreshTokens(9);

    const all = [...mockLog, ...mockPoolQuery.mock.calls.map(([sql, params]) => ({ sql, params }))]
      .filter((l) => /refresh_tokens|password_reset_tokens/.test(l.sql));
    expect(all.length).toBeGreaterThan(5);
    for (const { sql, params } of all) {
      const flat = sql.replace(/\s+/g, ' ');
      expect(flat).not.toMatch(/\bnow\(\)(?! AT TIME ZONE 'UTC')/);
      (params || []).forEach((p) => expect(p instanceof Date).toBe(false));
    }
  });

  test('insert statements derive created_at and expires_at from the SAME database clock', async () => {
    mockPoolQuery.mockResolvedValue(R([{ token_id: 4 }]));
    await repo.insertRefreshToken({ userId: 9, rawToken: 'a', ttlSeconds: 120 });
    const [sql, params] = mockPoolQuery.mock.calls[0];
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toMatch(/VALUES \(\$1, \$2, \(now\(\) AT TIME ZONE 'UTC'\), \(now\(\) AT TIME ZONE 'UTC'\) \+ make_interval\(secs => \$3::double precision\)\)/);
    expect(params).toEqual([9, repo.sha256hex('a'), 120]);
  });
});
