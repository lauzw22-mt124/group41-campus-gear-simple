require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require('node:path');
const db = require('./database');
const { loadUser, requireLogin, csrf } = require('./middleware/auth');
const { fail, normalize } = require('./helpers');

// Tests create the same app with a temporary database and session store.
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

  // 1. Read form/JSON input, serve static files and select EJS views.
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

  // 2. Restore the logged-in user and protect web forms against forged requests.
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

  // 3. API and web routes use the same service functions.
  app.use(require('./routes/auth'));
  app.use('/api', require('./routes/api'));
  app.use(requireLogin);
  app.get('/', (req, res) => res.redirect('/equipment'));
  app.use('/equipment', require('./routes/equipment'));
  app.use('/loans', require('./routes/loans'));
  app.use((req, res) => fail(404, 'NOT_FOUND', 'Page or endpoint not found.'));

  // Express 5 forwards errors from async routes to this one handler.
  app.use((err, req, res, next) => {
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
  });
  return app;
}

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
  const host = '127.0.0.1'; // Local classroom use only.
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
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require('node:path');
const db = require('./database');
const { loadUser, requireLogin, csrf } = require('./middleware/auth');
const { fail, normalize } = require('./helpers');

// Tests create the same app with a temporary database and session store.
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

  // 1. Read form/JSON input, serve static files and select EJS views.
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

  // 2. Restore the logged-in user and protect web forms against forged requests.
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

  // 3. API and web routes use the same service functions.
  app.use(require('./routes/auth'));
  app.use('/api', require('./routes/api'));
  app.use(requireLogin);
  app.get('/', (req, res) => res.redirect('/equipment'));
  app.use('/equipment', require('./routes/equipment'));
  app.use('/loans', require('./routes/loans'));
  app.use((req, res) => fail(404, 'NOT_FOUND', 'Page or endpoint not found.'));

  // Express 5 forwards errors from async routes to this one handler.
  app.use((err, req, res, next) => {
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
  });
  return app;
}

async function start() {
  await db.connect(process.env.MONGODB_URI);
  const store = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
  });
  const app = createApp({
    secret: process.env.SESSION_SECRET,
    store,
    production: process.env.NODE_ENV === 'production',
    apiAuthRequired: process.env.API_AUTH_REQUIRED === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
  const port = Number(process.env.PORT || 8099);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`Campus Gear: http://${host}:${port}`));
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
