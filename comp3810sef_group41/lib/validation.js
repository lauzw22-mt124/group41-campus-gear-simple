/**
 * Input validation primitives shared by the web and JSON routes.
 * Every helper either returns a normalised value or throws a 400 AppError.
 */

const mongoose = require('mongoose');
const { fail } = require('./errors');

/**
 * Validates a string field and trims it.
 * @param {unknown} value Raw input value.
 * @param {string} label Field label used in error messages.
 * @param {{required?: boolean, max?: number}} [options]
 * @returns {string} Trimmed value.
 */
function text(value, label, { required = true, max = 120 } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') fail(400, 'INVALID_INPUT', `${label} has an invalid format.`);
  value = value.trim();
  if ((required && !value) || value.length > max)
    fail(
      400,
      'INVALID_INPUT',
      `${label} is required when applicable and must not exceed ${max} characters.`,
    );
  return value;
}

/**
 * Validates a 24-character hexadecimal MongoDB ObjectId.
 * @param {unknown} value Raw input value.
 * @returns {string} The original valid ID.
 */
function id(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(value) ||
    !mongoose.isValidObjectId(value)
  )
    fail(400, 'INVALID_ID', 'Invalid record ID.');
  return value;
}

/**
 * Validates that a value is one of the allowed enum values.
 * @param {unknown} value Raw input value.
 * @param {readonly string[]} choices Allowed values.
 * @param {string} label Field label used in error messages.
 * @returns {string} The validated value.
 */
function choice(value, choices, label) {
  value = text(value, label);
  if (!choices.includes(value)) fail(400, 'INVALID_INPUT', `${label} is not an allowed value.`);
  return value;
}

/**
 * Rejects unknown writable fields. Used as an allow-list so clients cannot
 * set server-controlled fields such as `_id`, `status` or timestamps.
 * @param {unknown} data Request body.
 * @param {readonly string[]} keys Allowed field names.
 * @returns {void}
 */
function allowed(data, keys) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    fail(400, 'INVALID_INPUT', 'Invalid request body.');
  for (const key of Object.keys(data))
    if (!keys.includes(key)) fail(400, 'UNKNOWN_FIELD', `Field is not writable: ${key}`);
}

/**
 * Escapes regular-expression metacharacters so user keywords are matched
 * literally instead of being interpreted as a pattern.
 * @param {string} value Raw keyword.
 * @returns {string} Escaped keyword.
 */
function literal(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rejects unsupported query-string parameters.
 * @param {Record<string, unknown>} query Express query object.
 * @param {readonly string[]} keys Allowed parameter names.
 * @returns {void}
 */
function filters(query, keys) {
  for (const key of Object.keys(query))
    if (!keys.includes(key)) fail(400, 'INVALID_QUERY', `Unsupported query parameter: ${key}`);
}

module.exports = { text, id, choice, allowed, literal, filters };
