/**
 * Application bootstrap.
 *
 * `createApp` assembles middleware and routes and is exported for scripts and
 * automated checks. `start` wires the local database, seed data, session store
 * and HTTP listener when the file is executed directly by `npm start`.
 */

require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require('node:path');
const db = require('./database');
const { loadUser, requireLogin, csrf } = require('./middleware/auth');
const { fail } = require('./helpers');
const errorHandler = require('./middleware/errorHandler');
const AuthRouter = require('./routes/AuthRouter');
const ApiRouter = require('./routes/ApiRouter');
const EquipmentRouter = require('./routes/EquipmentRouter');
const LoanRouter = require('./routes/LoanRouter');

/**
 * Builds the Express application.
 * @param {object} options
 * @param {string} options.secret Session secret (at least 32 characters).
 * @param {object} [options.store] express-session store.
 * @param {boolean} [options.production] Enable HTTPS-only cookies and HSTS.
 * @param {boolean} [options.apiAuthRequired] Require a session for API calls.
 * @param {boolean} [options.trustProxy] Trust the first reverse proxy.
 * @returns {import('express').Express} Configured application.
 */
function createApp({
  secret,
  store,
  production = false,
  apiAuthRequired = false,
  trustProxy = false,
}) {
  if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
    throw new Error('Set a random SESSION_SECRET with at least 32 characters.');
  }
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.locals.apiAuthRequired = apiAuthRequired;

  // Request pipeline: security headers, static files, body parsers, health check.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': production ? [] : null },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use('/static', express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(express.json({ limit: '20kb' }));
  app.get('/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
  });

  // Session restoration, CSRF protection and shared EJS helpers.
  app.use(
    session({
      name: 'group41.sid',
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 4 * 60 * 60 * 1000 },
    }),
  );
  app.use(loadUser);
  app.use(csrf);
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.labels = {
      available: 'Available',
      borrowed: 'Borrowed',
      maintenance: 'Maintenance',
      active: 'Active',
      returned: 'Returned',
      projector: 'Projector',
      microphone: 'Microphone',
      tripod: 'Tripod',
    };
    res.locals.date = (value) =>
      value
        ? new Date(value).toLocaleString('en-GB', {
            timeZone: 'Asia/Hong_Kong',
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : '—';
    next();
  });

  // Public entry points (sign-in, health, JSON API) followed by protected pages.
  app.use(new AuthRouter().build());
  app.use('/api', new ApiRouter().build());
  app.use(requireLogin);
  app.get('/', (req, res) => res.redirect('/equipment'));
  app.use('/equipment', new EquipmentRouter().build());
  app.use('/loans', new LoanRouter().build());
  app.use((req, res) => fail(404, 'NOT_FOUND', 'Page or endpoint not found.'));

  app.use(errorHandler);
  return app;
}

/**
 * Connects the local MongoDB, seeds initial data, starts the session store and
 * listens on 127.0.0.1:PORT. Handles startup errors and graceful shutdown.
 * @returns {Promise<void>}
 */
async function start() {
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET.startsWith('replace-')
  ) {
    throw new Error('Set SESSION_SECRET in .env before starting. See README.md.');
  }
  console.log('Starting local MongoDB (the first run may download MongoDB 7.0.24)...');
  await db.connectLocal();
  await require('./scripts/seed').seed({
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  });
  const store = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
  });
  const app = createApp({
    secret: process.env.SESSION_SECRET,
    store,
    apiAuthRequired: process.env.API_AUTH_REQUIRED === 'true',
  });
  const port = Number(process.env.PORT || 8099);
  const host = '127.0.0.1'; // Loopback-only deployment.
  const server = app.listen(port, host, () => console.log(`Campus Gear: http://${host}:${port}`));
  server.on('error', async (err) => {
    console.error(
      err.code === 'EADDRINUSE' ? `Port ${port} is busy. Stop the other app first.` : err.message,
    );
    await db.disconnect();
    process.exit(1);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () =>
      server.close(async () => {
        await db.disconnect();
        process.exit(0);
      }),
    );
  }
}

if (require.main === module) {
  start().catch(async (err) => {
    console.error(err.message);
    await db.disconnect();
    process.exit(1);
  });
}
module.exports = { createApp };
