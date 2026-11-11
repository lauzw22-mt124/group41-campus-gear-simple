# Campus Gear — Group41

Application files are in [`comp3810sef_group41/`](comp3810sef_group41/). File paths below are relative to that folder; the GitHub Actions workflow is at repository root.

## 1. Project info

A small **Express + Mongoose + EJS** application for lending campus projectors, microphones and tripods. One record represents one physical asset; it is not a quantity inventory.

- Log in and out as an administrator; web management pages require login.
- Create, search, edit and delete equipment. Combine keyword, category and status filters.
- Check out an available asset, search loans by borrower/status, and record its return.
- Send an available asset for maintenance and finish maintenance when ready.
- Use the same operations through REST APIs with GET, POST, PUT and DELETE.

**Rules:** only Available equipment can be borrowed. An asset may have at most one Active loan. Returning it updates the loan and restores availability. Only Available equipment with no loan history can be deleted.

**Provenance:** The initial implementation and this simplification were prepared with an AI coding agent. The course prohibits purely Agent-completed submissions. Members must independently understand, adapt and test their work and record their actual contributions; the ownership table below is not proof of completed student work.

## 2. Group info

Group **41** · COMP3810SEF. Names and SIDs below are preserved from the group's existing README.

| Role | Student     | SID      | Ownership                                           |
| ---- | ----------- | -------- | --------------------------------------------------- |
| A    | LIU Jinwei  | 13756142 | Server setup, login/logout and integration          |
| B    | HE Ziqian   | 13749372 | Mongoose models, database, seed and equipment rules |
| C    | ZHU Hengxi  | 13654149 | Equipment web CRUD and filters                      |
| D    | LEI Haodong | 13733952 | Borrowing, returning and maintenance                |
| E    | SHEN Xin    | 13630649 | REST routes and curl demonstration                  |
| F    | LIU Jiaxu   | 13710084 | Interface, testing and presentation coordination    |

Use one branch per actual task. Pull the latest `main`, make your change, run `npm test`, then open a pull request for another member to review. Keep passwords and database URLs in your own `.env`. Repository write access does not share a local database. Record actual PR links/contributions before submission; do not manufacture six authors for the initial implementation.

## 3. Project file intro

Start with this flow: **route → service → Mongoose model → MongoDB → EJS page or JSON**.

| File / folder                                           | What to read it for                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `server.js`                                             | Express setup, sessions, routes and error handler; application entry point.   |
| `database.js`                                           | Connects to MongoDB and builds unique indexes.                                |
| `models/User.js`                                        | Administrator username and password hash.                                     |
| `models/Equipment.js`                                   | Physical equipment fields and states.                                         |
| `models/Loan.js`                                        | Borrower, equipment reference and loan dates; one-active-loan index.          |
| `routes/auth.js`, `middleware/auth.js`                  | Login/logout, user loading, authorization and CSRF tokens.                    |
| `routes/equipment.js`, `routes/loans.js`                | Receives forms and renders the management pages.                              |
| `routes/api.js`                                         | JSON endpoints using the same services as the forms.                          |
| `services/equipmentService.js`                          | Equipment CRUD, filters and maintenance.                                      |
| `services/loanService.js`                               | Borrow, return and loan search.                                               |
| `helpers.js`                                            | Shared input validation and error messages.                                   |
| `views/`, `public/`                                     | English EJS pages, one stylesheet and small confirmation/back-button helpers. |
| `scripts/seed.js`                                       | Creates a missing administrator and sample equipment.                         |
| `scripts/demo-api.sh`                                   | Prepared curl demonstration.                                                  |
| `tests/integration.test.js`, `.github/workflows/ci.yml` | Regression tests and their automatic Ubuntu run.                              |
| `package.json`, `package-lock.json`                     | Dependencies and reproducible installation; the lockfile is generated.        |
| `docs/API.md`, `docs/DEMO.md`                           | API examples and a short presentation/code walkthrough.                       |

Runtime packages: Express (requests), EJS (HTML), Mongoose (data), dotenv (settings), express-session/connect-mongo (persistent login), bcryptjs (password hashes), Helmet (response headers) and express-rate-limit (login attempts). Supertest and mongodb-memory-server are used only by tests.

## 4. Operation guides

### Start the application

Use **Node.js 22** and one persistent MongoDB replica-set database. For a new setup, use a MongoDB Atlas connection string. An existing replica-set URI also works; a standalone MongoDB server cannot run the loan transactions. This version has one normal startup path and no `npm run demo` or Docker setup.

```bash
git clone https://github.com/lauzw22-mt124/group41-campus-gear-simple.git
cd group41-campus-gear-simple/comp3810sef_group41
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Edit `.env` before continuing:

1. Set `MONGODB_URI` to your Atlas URI, including database name `group41`, database user and password. Allow your development machine's IP in Atlas. URL-encode special characters in the database password.
2. Paste the generated value into `SESSION_SECRET`.
3. Set `ADMIN_USERNAME=admin41` and your own `ADMIN_PASSWORD` (at least 12 characters).
4. Leave `HOST=127.0.0.1`, `PORT=8099`, `NODE_ENV=development` and `API_AUTH_REQUIRED=false` for the local classroom demonstration.

```bash
npm run seed
npm start
```

Open **http://127.0.0.1:8099**. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env`. There is no fixed public administrator password in the normal installation. Seed inserts only missing records: existing passwords, equipment and loan history are preserved. Changing `.env` does not reset an account that already exists. Database data and login sessions persist across server restarts.

For the presentation, run this setup on your **local Ubuntu** machine as required by the course, unless using a separately configured cloud host. Rehearse on that exact environment. An Internet-facing host additionally needs HTTPS, `NODE_ENV=production` and `API_AUTH_REQUIRED=true`; `TRUST_PROXY=true` is only for one trusted HTTPS reverse proxy. Making GitHub public does not deploy this application.

### Web demonstration

1. **Login:** open `/login` and sign in. The equipment list is the home page.
2. **Create:** select **Add equipment**, fill its unique asset code, name, category and location, then **Save equipment**. It starts as Available.
3. **Read:** use keyword (name/code), category and status together; select **Search**. **Clear** resets the filters.
4. **Update:** open **View details** → **Edit record**, change the location, then save.
5. **Delete:** create a separate unused asset, open its details and select **Delete equipment**. Borrowed, maintenance and history-bearing assets cannot be deleted.
6. **Borrow:** on an Available asset select **Check out**, enter a fictional borrower name/ID and confirm. The asset becomes Borrowed; the loan becomes Active.
7. **Return:** open **Loans**, filter by borrower/status and select **Return equipment**. The loan becomes Returned and the asset becomes Available.
8. **Maintenance:** select **Send for maintenance** on an Available asset, then **Finish maintenance**. Maintenance equipment cannot be borrowed.
9. **Logout:** select **Sign out**; attempting to reopen a management page redirects to login.

Optional notes/expected return remain supported for compatibility. The server records actual borrow/return times; the UI displays Hong Kong time.

### REST demonstration and tests

While the server runs, open a second terminal:

```bash
bash scripts/demo-api.sh http://127.0.0.1:8099
```

The script uses curl, prints responses and checks their HTTP codes. It demonstrates all API routes, including conflicts, and retains a returned fictional loan as history. It deletes only the unused asset it creates. Run it on a demonstration database. See [API payloads and manual curl commands](comp3810sef_group41/docs/API.md).

```bash
npm test
```

Tests use a separate, temporary **real MongoDB replica set**, not your `.env` database. The first run downloads MongoDB 7.0.24. Tests cover web/API CRUD, login, validation, concurrent loans, rollback, deletion history, XSS and session persistence. Do not remove the checks merely to reduce the file count.

### Course checklist

| Required item                                                   | Where to show it                                  |
| --------------------------------------------------------------- | ------------------------------------------------- |
| Express, MongoDB/Mongoose, login/logout, protected CRUD pages   | Running website and `server.js` / models          |
| Searches using different conditions                             | Equipment and loan filters                        |
| GET, POST, PUT, DELETE                                          | Prepared curl script                              |
| Project/group info, file intro, operation guide                 | These four README sections                        |
| Ten-minute live presentation, all web/API services              | [Presentation and code walkthrough](comp3810sef_group41/docs/DEMO.md) |
| Submission folder with `server.js`, `package.json`, `README.md` | `comp3810sef_group41` inside the ZIP              |

Exclude `node_modules`, `.env`, `.git` and database caches from the ZIP. Follow the current OLE instructions for deadlines and filename conventions. Complete a timed rehearsal and the group's actual contribution records before submission.
