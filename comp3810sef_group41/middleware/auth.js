/**
 * Session-aware middleware.
 * `loadUser` resolves the signed-in administrator once per request,
 * `requireLogin` protects the HTML pages and `csrf` issues and verifies the
 * token used by every form write.
 */

const crypto = require('node:crypto');
const User = require('../models/User');
const { fail } = require('../helpers');

/**
 * Loads the current user from the session into `req.user` and `res.locals`.
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {Promise<void>}
 */
async function loadUser(req, res, next) {
  req.user = req.session.userId ? await User.findById(req.session.userId).lean() : null;
  res.locals.user = req.user;
  next();
}

/**
 * Redirects anonymous page requests to /login and rejects anonymous API calls
 * with 401 when `API_AUTH_REQUIRED` is enabled.
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {void}
 */
function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) fail(401, 'AUTH_REQUIRED', 'Please sign in first.');
  res.redirect('/login');
}

/**
 * Issues a session CSRF token and verifies it on HTML form writes.
 * API routes are exempt because write requests must use `application/json`,
 * which browsers cannot send cross-origin without a CORS preflight.
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {void}
 */
function csrf(req, res, next) {
  req.session.csrf ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/api/')) {
    const token = req.body?._csrf;
    // Length check first: timingSafeEqual throws on different buffer sizes.
    if (
      typeof token !== 'string' ||
      Buffer.byteLength(token) !== Buffer.byteLength(req.session.csrf) ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrf))
    )
      fail(403, 'CSRF', 'Your form has expired. Refresh the page and try again.');
  }
  next();
}

module.exports = { loadUser, requireLogin, csrf };
