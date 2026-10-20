/**
 * D3 — e-mail normalisation. Only trim + lower-case (what schema.sql's
 * ck_users_email_lower requires); Gmail dots and +tags must be preserved.
 */
'use strict';

const { validationResult } = require('express-validator');
const validation = require('../../src/validation/authValidation');
const { normaliseEmail } = require('../../src/utils/email');
const repo = require('../../src/services/userRepository');

async function runRules(rules, body) {
  const req = { body: { ...body } };
  for (const rule of rules) await rule.run(req);
  return { req, errors: validationResult(req) };
}

const GOOD = { name: 'Priya', password: 'Railway@Secure1!' };

describe('normaliseEmail', () => {
  test('trims and lower-cases only', () => {
    expect(normaliseEmail('  John.Doe@Example.COM \n')).toBe('john.doe@example.com');
  });

  test('does NOT remove Gmail dots or +tags', () => {
    expect(normaliseEmail('John.Doe+rail@gmail.com')).toBe('john.doe+rail@gmail.com');
    expect(normaliseEmail('John.Doe+rail@gmail.com')).not.toBe('johndoe@gmail.com');
  });

  test('does not rewrite googlemail.com to gmail.com', () => {
    expect(normaliseEmail('a@googlemail.com')).toBe('a@googlemail.com');
  });

  test('leaves non-strings untouched so validators can reject them', () => {
    expect(normaliseEmail(undefined)).toBeUndefined();
    expect(normaliseEmail({ a: 1 })).toEqual({ a: 1 });
  });

  test('repository uses the very same function (single convention)', () => {
    expect(repo.normaliseEmail).toBe(normaliseEmail);
  });

  test('satisfies the database CHECK: email = lower(btrim(email))', () => {
    const e = normaliseEmail('  MiXeD.Case+Tag@Example.Org ');
    expect(e).toBe(e.trim().toLowerCase());
  });
});

describe.each([
  ['registerRules',       () => validation.registerRules,       GOOD],
  ['loginRules',          () => validation.loginRules,          { password: 'x' }],
  ['forgotPasswordRules', () => validation.forgotPasswordRules, {}],
])('%s e-mail sanitisation', (_name, getRules, extra) => {
  test('John.Doe+rail@gmail.com keeps its dots and +tag', async () => {
    const { req, errors } = await runRules(getRules(), { ...extra, email: 'John.Doe+rail@gmail.com' });
    expect(errors.isEmpty()).toBe(true);
    expect(req.body.email).toBe('john.doe+rail@gmail.com');
    expect(req.body.email).not.toBe('johndoe@gmail.com');
  });

  test('surrounding whitespace is trimmed and case folded', async () => {
    const { req, errors } = await runRules(getRules(), { ...extra, email: '  Mixed.Case@Example.COM ' });
    expect(errors.isEmpty()).toBe(true);
    expect(req.body.email).toBe('mixed.case@example.com');
  });

  test('two distinct addresses stay distinct', async () => {
    const a = await runRules(getRules(), { ...extra, email: 'john.doe@gmail.com' });
    const b = await runRules(getRules(), { ...extra, email: 'johndoe@gmail.com' });
    expect(a.req.body.email).not.toBe(b.req.body.email);
  });

  test.each(['not-an-email', '', 'a@b', 'a b@c.com', 12345, null, { x: 1 }])(
    'rejects invalid e-mail %p',
    async (bad) => {
      const { errors } = await runRules(getRules(), { ...extra, email: bad });
      expect(errors.isEmpty()).toBe(false);
    }
  );
});

describe('register password rules', () => {
  test('rejects passwords longer than bcrypt\'s 72 bytes', async () => {
    const { errors } = await runRules(validation.registerRules, {
      ...GOOD, email: 'a@b.co', password: 'Aa1!' + 'x'.repeat(80),
    });
    expect(errors.isEmpty()).toBe(false);
  });

  test('accepts a 72-byte password', async () => {
    const { errors } = await runRules(validation.registerRules, {
      ...GOOD, email: 'a@b.co', password: 'Aa1!' + 'x'.repeat(68),
    });
    expect(errors.isEmpty()).toBe(true);
  });
});
