# Campus Gear application

Express 5 application that provides the Campus Gear equipment loan system: EJS management pages, a JSON API, and a local MongoDB instance for persistence.

## Quick start

```bash
npm ci --ignore-scripts
cp -n .env.example .env    # set SESSION_SECRET and ADMIN_PASSWORD
npm start
```

Open `http://127.0.0.1:8099/login` and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

Full documentation, configuration and API reference: [project README](../README.md).
