const crypto = require('node:crypto');
const User = require('../models/User');
const { fail } = require('../helpers');
async function loadUser(req, res, next) {
  req.user = req.session.userId ? await User.findById(req.session.userId).lean() : null;
  res.locals.user = req.user;
  next();
}
function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) fail(401, 'AUTH_REQUIRED', 'Please sign in first.');
  res.redirect('/login');
}
function csrf(req, res, next) {
  req.session.csrf ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/api/')) {
    const token = req.body?._csrf;
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
