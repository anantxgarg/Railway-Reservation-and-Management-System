/**
 * authValidation.js — Input validation rules for auth endpoints.
 *
 * Uses express-validator. Each exported array can be spread into a route
 * definition. The validate() helper converts validation errors into the
 * project's standard error response format.
 *
 * Password policy (enforced here, not in the DB):
 *   - Minimum 8 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *   - At least one special character
 */
'use strict';

const { body, param, validationResult } = require('express-validator');
const { normaliseEmail } = require('../utils/email');

// ─────────────────────────────────────────────────────────────────────────────
// Shared rules
// ─────────────────────────────────────────────────────────────────────────────

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PHONE_REGEX    = /^\+?[0-9]{10,15}$/;

// bcrypt only uses the first 72 BYTES of its input; longer passwords would be
// silently truncated, so reject them instead.
const BCRYPT_MAX_BYTES = 72;

const passwordRule = (field = 'password') =>
  body(field)
    .isString().withMessage(`${field} must be a string`)
    .bail()
    .matches(PASSWORD_REGEX)
    .withMessage(
      `${field} must be at least 8 characters and contain an uppercase letter, ` +
      'a lowercase letter, a digit, and a special character'
    )
    .custom((v) => Buffer.byteLength(v, 'utf8') <= BCRYPT_MAX_BYTES)
    .withMessage(`${field} must be at most ${BCRYPT_MAX_BYTES} bytes`);

/**
 * E-mail rule shared by register / login / forgot-password.
 * Sanitisation is ONLY trim + lower-case (utils/email.js) — exactly what the
 * database's ck_users_email_lower constraint requires. Gmail dots and
 * "+tag" sub-addresses are preserved.
 */
const emailRule = () =>
  body('email')
    .isString().withMessage('email must be a string')
    .bail()
    .customSanitizer(normaliseEmail)
    .isLength({ max: 255 }).withMessage('email must be at most 255 characters')
    .isEmail({ allow_utf8_local_part: false }).withMessage('email must be a valid email address');

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint-specific rule sets
// ─────────────────────────────────────────────────────────────────────────────

const registerRules = [
  body('name')
    .isString().withMessage('name must be a string')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be at most 100 characters'),

  emailRule(),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(PHONE_REGEX).withMessage('phone must be 10–15 digits, optionally starting with +'),

  passwordRule('password'),
];

const loginRules = [
  emailRule(),

  body('password')
    .isString().withMessage('password must be a string')
    .notEmpty().withMessage('password is required')
    .isLength({ max: 1024 }).withMessage('password is too long'),
];

const refreshRules = [
  body('refreshToken')
    .isString().withMessage('refreshToken must be a string')
    .notEmpty().withMessage('refreshToken is required')
    .isLength({ max: 512 }).withMessage('refreshToken is too long'),
];

const changePasswordRules = [
  body('currentPassword')
    .isString().withMessage('currentPassword must be a string')
    .notEmpty().withMessage('currentPassword is required')
    .isLength({ max: 1024 }).withMessage('currentPassword is too long'),
  passwordRule('newPassword'),
];

const forgotPasswordRules = [
  emailRule(),
];

const resetPasswordRules = [
  body('token')
    .isString().withMessage('token must be a string')
    .notEmpty().withMessage('token is required')
    .isLength({ max: 512 }).withMessage('token is too long'),
  passwordRule('newPassword'),
];

const userIdParamRules = [
  param('userId')
    .isInt({ min: 1, max: 2147483647 }).withMessage('userId must be a positive integer'),
];

// ─────────────────────────────────────────────────────────────────────────────
// Validation-result middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that reads express-validator results and returns a 400 response
 * if any rule failed. Must be placed AFTER the rule arrays in the route.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    error: {
      code:    'VALIDATION_ERROR',
      message: 'Request validation failed',
      fields:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    },
  });
}

module.exports = {
  registerRules,
  loginRules,
  refreshRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
  userIdParamRules,
  validate,
};
