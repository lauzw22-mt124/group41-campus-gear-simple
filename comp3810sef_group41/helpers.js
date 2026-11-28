/**
 * Public helper facade. Validation lives in `lib/validation.js`, error types
 * in `lib/errors.js`. Route and service modules import both from here so the
 * import surface stays small.
 */
module.exports = {
  ...require('./lib/errors'),
  ...require('./lib/validation'),
};
