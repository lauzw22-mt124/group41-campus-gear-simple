/**
 * Error types and normalisation shared by services, middleware and routes.
 * Services throw {@link AppError} through {@link fail}; the global error
 * handler turns it into an HTTP response.
 */

/**
 * Application error carrying an HTTP status and a stable machine-readable code.
 */
class AppError extends Error {
  /**
   * @param {number} status HTTP status code.
   * @param {string} code Stable error code returned to API clients.
   * @param {string} message Human-readable message.
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Throws an AppError. Keeps validation branches short.
 * @param {number} status HTTP status code.
 * @param {string} code Stable error code.
 * @param {string} message Human-readable message.
 * @returns {never}
 */
function fail(status, code, message) {
  throw new AppError(status, code, message);
}

/**
 * Converts any thrown value into an AppError suitable for an HTTP response.
 * Handles body-parser failures, duplicate keys and Mongoose validation errors.
 * @param {unknown} error Value caught by the error handler.
 * @returns {AppError}
 */
function normalize(error) {
  if (error.type === 'entity.parse.failed')
    return new AppError(400, 'INVALID_JSON', 'Malformed JSON.');
  if (error.type === 'entity.too.large')
    return new AppError(413, 'TOO_LARGE', 'Request body is too large.');
  if (error instanceof AppError) return error;
  if (error.code === 11000)
    return new AppError(
      409,
      'DUPLICATE',
      'This asset code already exists, or the equipment already has an active loan.',
    );
  if (error.name === 'ValidationError' || error.name === 'CastError')
    return new AppError(400, 'INVALID_INPUT', 'Invalid input fields or record ID.');
  return new AppError(
    500,
    'INTERNAL_ERROR',
    'The operation could not be completed. Please try again.',
  );
}

module.exports = { AppError, fail, normalize };
