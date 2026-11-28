# Campus Gear

Campus Gear is an equipment loan management system for campus audio-visual resources. It keeps one record per projector, microphone or tripod and tracks availability, maintenance, checkouts and returns.

## Features

- Session-based administrator authentication with rate-limited login.
- Equipment register with unique asset codes, categories, locations and status.
- Keyword, category and status search.
- Checkout and return workflow with borrower details, optional due date and full loan history.
- Maintenance state management.
- REST API for equipment CRUD, maintenance and loan operations.
- Consistent equipment and loan state through MongoDB transactions and a partial unique index.
- Server-rendered interface with no front-end build step or external assets.

## Technology

| Area | Choice |
| --- | --- |
| Runtime | Node.js 22 or later |
| Web framework | Express 5 |
| Views | EJS |
| Database | MongoDB 7 via Mongoose 8 |
| Sessions | express-session with a MongoDB store |
| Security | helmet, bcryptjs, express-rate-limit |

## Architecture

The system is a single Express application that serves both the management pages and the JSON API:

```text
Browser / API client
        │
        ▼
Express application (server.js)
  ├── routes/       class-based routers; each extends AbstractRouter
  ├── services/     business rules; EquipmentService and LoanService
  │                 share the CRUD flow defined by AbstractService
  ├── models/       Mongoose schemas, indexes and validation rules
  ├── lib/          input validation, error types and response envelopes
  └── views/        EJS templates for the management interface
        │
        ▼
MongoDB replica set (started locally by database.js)
```

Both layers use an abstract base class: `AbstractRouter` defines the route registration template (`register()` / `build()`), and `AbstractService` defines the shared CRUD template (`validatePayload` / `buildFilter` / `buildQuery`). The web pages and the JSON API call the same service methods, so validation and state transitions are enforced in one place. Equipment updates and loan creation or return run in a MongoDB transaction. A partial unique index permits many returned loans but only one active loan per asset.

## Project layout

```text
comp3810sef_group41/
├── server.js                 application bootstrap and middleware
├── database.js               MongoDB lifecycle and connection
├── helpers.js                shared validation and error helpers
├── lib/                      validation, errors, API response envelopes
├── middleware/               session loading, authentication and CSRF
├── models/                   Equipment, Loan and User schemas
├── services/                 AbstractService, EquipmentService, LoanService
├── routes/                   AbstractRouter and the page/API router classes
├── views/                    EJS templates
├── public/                   stylesheet and client-side scripts
├── scripts/seed.js           initial administrator and sample data
└── .env.example              configuration template
```

## Requirements

- Node.js 22 or later and npm.
- Internet access on first start to download the MongoDB 7.0.24 binary.
- No external database server or Docker installation is required.

## Installation

```bash
git clone https://github.com/lauzw22-mt124/group41-campus-gear-simple.git
cd group41-campus-gear-simple/comp3810sef_group41
npm ci --ignore-scripts
cp .env.example .env
```

Generate a session secret and paste it into `SESSION_SECRET` in `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Yes | — | Random string of at least 32 characters used to sign session cookies. |
| `ADMIN_USERNAME` | Yes | `admin41` | Administrator username created on first start. |
| `ADMIN_PASSWORD` | Yes | — | Administrator password of at least 12 characters. Used when the account is first created. |
| `PORT` | No | `8099` | HTTP port. |
| `API_AUTH_REQUIRED` | No | `false` | Set to `true` to require a signed-in session for API requests. |

## Running

```bash
npm start
```

Open `http://127.0.0.1:8099/login` and sign in with the configured administrator credentials. The server binds to the loopback interface only.

On first start the application downloads MongoDB 7.0.24, starts a local instance on `127.0.0.1:27041`, and seeds the administrator account and sample equipment. Existing records are preserved on later starts.

## API

The complete request and response reference is in [api.md](api.md). All endpoints return JSON. API access can run without a session in local mode, or require an authenticated session when `API_AUTH_REQUIRED=true`.

## Data and persistence

- Database files are stored in `comp3810sef_group41/.local-data/mongodb` and survive restarts.
- The MongoDB binary cache is stored in `comp3810sef_group41/.cache/mongodb`.
- Login sessions are stored in the MongoDB `sessions` collection.
- Sample equipment and the administrator account are inserted only when missing; existing data and passwords are never overwritten.

## Security

- Administrator passwords are stored as bcrypt hashes.
- Login regenerates the session and is rate limited per IP address.
- HTML form writes require a CSRF token; API writes require a JSON content type.
- Security headers are applied with helmet, and all writable fields are validated against an allow-list.
- EJS output is escaped, and the application sets `Cache-Control: no-store` on responses.

## Version

1.5.0

## Authors

Group 41:

| Student | SID |
| --- | --- |
| LIU Jinwei | 13756142 |
| HE Ziqian | 13749372 |
| ZHU Hengxi | 13654149 |
| LEI Haodong | 13733952 |
| SHEN Xin | 13630649 |
| LIU Jiaxu | 13710084 |
