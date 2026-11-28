/**
 * Global Express error handler.
 * Express 5 forwards rejected async handlers here automatically.
 * API requests receive a JSON error envelope; browser requests render the
 * EJS error page with the current user and CSRF token.
 */

const { normalize } = require('../helpers');

/**
 * @param {unknown} err Thrown value.
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {void}
 */
function errorHandler(err, req, res, next) {
  const error = normalize(err);
  if (error.status >= 500) console.error(err.message);
  if (req.path.startsWith('/api/')) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  res.status(error.status).render('error', {
    title: 'Unable to complete the action',
    error,
    user: req.user || null,
    csrf: res.locals.csrf || '',
  });
}

module.exports = errorHandler;
