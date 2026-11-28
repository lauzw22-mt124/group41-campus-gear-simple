/**
 * Session authentication router.
 *
 * Login regenerates the session before storing the user ID (preventing session
 * fixation); logout destroys the session and clears the cookie. Login attempts
 * are rate limited per IP address.
 */

const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const AbstractRouter = require('./AbstractRouter');
const User = require('../models/User');
const { text } = require('../helpers');

// Pre-computed hash used when the username does not exist, so a failed lookup
// takes the same bcrypt time as a wrong password.
const dummy = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);

class AuthRouter extends AbstractRouter {
  constructor() {
    super('Auth');
  }

  /** @inheritdoc */
  register() {
    /** GET /login - render the sign-in form, or redirect a signed-in user. */
    this.get('/login', (req, res) =>
      req.user
        ? res.redirect('/equipment')
        : res.render('login', { title: 'Administrator sign-in', error: null }),
    );

    /** POST /login - verify credentials and create an authenticated session. */
    this.post(
      '/login',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: 'Too many attempts. Please try again in 15 minutes.',
      }),
      async (req, res) => {
        const username = text(req.body.username, 'Username', { max: 80 });
        const password = req.body.password;
        if (typeof password !== 'string' || !password || password.length > 200) {
          return res.status(401).render('login', {
            title: 'Administrator sign-in',
            error: 'Incorrect username or password.',
          });
        }
        const user = await User.findOne({ username }).select('+passwordHash');
        const ok = await bcrypt.compare(password, user?.passwordHash || dummy);
        if (!user || !ok) {
          return res.status(401).render('login', {
            title: 'Administrator sign-in',
            error: 'Incorrect username or password.',
          });
        }
        // Regenerate first, then persist the user ID before redirecting.
        await new Promise((resolve, reject) =>
          req.session.regenerate((err) => (err ? reject(err) : resolve())),
        );
        req.session.userId = user.id;
        await new Promise((resolve, reject) =>
          req.session.save((err) => (err ? reject(err) : resolve())),
        );
        res.redirect('/equipment');
      },
    );

    /** POST /logout - destroy the session and redirect to the login page. */
    this.post('/logout', async (req, res) => {
      await new Promise((resolve, reject) =>
        req.session.destroy((err) => (err ? reject(err) : resolve())),
      );
      res.clearCookie('group41.sid');
      res.redirect('/login');
    });
  }
}

module.exports = AuthRouter;
