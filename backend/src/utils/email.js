/**
 * email.js — The ONE e-mail normalisation used by validation, registration,
 * login, password recovery and every repository lookup.
 *
 * The database (schema.sql, ck_users_email_lower) only accepts
 *     email = lower(btrim(email))
 * so the only transformation applied is: trim surrounding whitespace and
 * lower-case. Provider-specific rewriting (removing Gmail dots, stripping
 * "+tag" sub-addresses) is deliberately NOT done: it would silently merge
 * distinct addresses and change what the user typed.
 */
'use strict';

/**
 * @param {*} email
 * @returns {*} trimmed, lower-cased string (non-strings are returned unchanged
 *              so validators can reject them)
 */
function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

module.exports = { normaliseEmail };
