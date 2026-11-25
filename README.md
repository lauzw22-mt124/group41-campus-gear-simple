# Campus Gear — Group 41

## Project info

Campus Gear tracks individual projectors, microphones and tripods for campus loans. Administrators sign in to search equipment, change its location, check it out, record returns and manage maintenance. Each asset has a unique code and retains its loan history.

The application lives in `comp3810sef_group41/`. Express starts in `server.js`. The web and JSON routes in `routes/` share the borrowing and equipment rules in `services/`. Mongoose models in `models/` store records in local MongoDB, and EJS templates in `views/` render the management pages.

## Group info

| Role | Student | SID | Responsibility |
| --- | --- | --- | --- |
| A | LIU Jinwei | 13756142 | Server setup, login/logout and integration |
| B | HE Ziqian | 13749372 | Mongoose models, database, seed data and equipment rules |
| C | ZHU Hengxi | 13654149 | Equipment web CRUD and search filters |
| D | LEI Haodong | 13733952 | Borrowing, returns and maintenance |
| E | SHEN Xin | 13630649 | REST routes and curl demonstration |
| F | LIU Jiaxu | 13710084 | Interface, testing and presentation coordination |

## Startup guide

On Ubuntu 24.04, use Node.js 22 with npm. First-time setup requires internet access to download dependencies and MongoDB. Install the runtime libraries once:

```bash
sudo apt update
sudo apt install -y git curl libcurl4t64 libssl3t64
```

For a fresh checkout:

```bash
git clone https://github.com/lauzw22-mt124/group41-campus-gear-simple.git
cd group41-campus-gear-simple/comp3810sef_group41
npm ci --ignore-scripts
cp -n .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

If you already have the source, open the folder containing `server.js` and `package.json` and start at `npm ci`. On first setup, paste the generated value into `SESSION_SECRET` in `.env`, keep `ADMIN_USERNAME=admin41` and set `ADMIN_PASSWORD` to a private password of at least 12 characters. Keep `PORT=8099` and `API_AUTH_REQUIRED=false` for the local curl demo. Existing installations keep their credentials.

Run `npm start`. Wait for the server address, then open [Campus Gear](http://127.0.0.1:8099/login) and sign in. Keep this terminal open. Press **Ctrl+C** to stop. On later runs, use `npm start` from the same folder. Records persist in `.local-data/mongodb/`.

## Equipment CRUD in four commands

Run these in a second Ubuntu terminal. Start with an unused asset code. Copy the **`data._id`** from Create and replace `ASSET_ID` in the next three commands. Each example prints the HTTP status and response.

### 1. Create — add a tripod (201)

```bash
curl -i -X POST 'http://127.0.0.1:8099/api/equipment' --json '{"assetCode":"CRUD-001","name":"Demo Tripod","category":"tripod","location":"Room A"}'
```

### 2. Read — look up that tripod (200)

```bash
curl -i 'http://127.0.0.1:8099/api/equipment/ASSET_ID'
```

### 3. Update — move it to Room B (200)

```bash
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID' --json '{"assetCode":"CRUD-001","name":"Demo Tripod","category":"tripod","location":"Room B"}'
```

### 4. Delete — remove the unused tripod (204, empty body)

```bash
curl -i -X DELETE 'http://127.0.0.1:8099/api/equipment/ASSET_ID'
```

## API reference

The application exposes nine REST endpoints and one health check. In local demo mode the API accepts the curl requests below directly. With `API_AUTH_REQUIRED=true`, send a signed-in session cookie with each API request. Web management pages always require login.

| Method | Full URL | Usage | Success |
| --- | --- | --- | --- |
| GET | `http://127.0.0.1:8099/health` | Check that the server is reachable. | 200 |
| POST | `http://127.0.0.1:8099/api/equipment` | Create equipment with a unique asset code. | 201 |
| GET | `http://127.0.0.1:8099/api/equipment` | List equipment or combine keyword, category and status filters. | 200 |
| GET | `http://127.0.0.1:8099/api/equipment/ASSET_ID` | Retrieve one asset by its database ID. | 200 |
| PUT | `http://127.0.0.1:8099/api/equipment/ASSET_ID` | Replace editable fields. Include code, name, category and location. | 200 |
| DELETE | `http://127.0.0.1:8099/api/equipment/ASSET_ID` | Delete an available asset with no loan history. | 204 |
| PUT | `http://127.0.0.1:8099/api/equipment/ASSET_ID/maintenance` | Send an available asset for maintenance or restore it to available. | 200 |
| POST | `http://127.0.0.1:8099/api/loans` | Check out an available asset and create an active loan. | 201 |
| GET | `http://127.0.0.1:8099/api/loans` | Search loans by borrower, status or equipment ID. | 200 |
| PUT | `http://127.0.0.1:8099/api/loans/LOAN_ID/return` | Return an active loan and make the asset available again. | 200 |

The four examples above cover equipment creation, retrieval by ID, update and deletion. For the remaining examples, choose another available asset and use its 24-character database ID for `ASSET_ID`.

### Health and equipment search

```bash
curl -i 'http://127.0.0.1:8099/health'
curl -i 'http://127.0.0.1:8099/api/equipment'
curl -i 'http://127.0.0.1:8099/api/equipment?q=Demo&category=projector&status=available'
```

`q` matches part of the asset code or name. Categories are `projector`, `microphone` and `tripod`. Status values are `available`, `borrowed` and `maintenance`. Equipment creation and updates also accept an optional `description`.

### Send for maintenance, then restore availability

```bash
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID/maintenance' --json '{"status":"maintenance"}'
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID/maintenance' --json '{"status":"available"}'
```

### Borrow an asset

```bash
curl -i -X POST 'http://127.0.0.1:8099/api/loans' --json '{"equipmentId":"ASSET_ID","borrowerName":"Chris Demo","borrowerId":"DEMO41"}'
```

Copy the loan's `data._id` from this response for `LOAN_ID`. Optional fields are `notes` and `dueAt` (a future ISO timestamp with a time zone).

### Search loans

```bash
curl -i 'http://127.0.0.1:8099/api/loans'
curl -i 'http://127.0.0.1:8099/api/loans?borrower=DEMO41&status=active'
curl -i 'http://127.0.0.1:8099/api/loans?equipmentId=ASSET_ID'
```

`borrower` matches the borrower's name or ID. Use `active` for outstanding loans and `returned` for completed loans.

### Return a loan

```bash
curl -i -X PUT 'http://127.0.0.1:8099/api/loans/LOAN_ID/return' --json '{}'
```

Successful data responses use `{"data": ...}`. Errors include a code and message. A duplicate asset code or a prohibited transition returns **409**. A missing record returns **404**. After a return, loan history remains attached to the equipment.

From the application folder, run `bash scripts/demo-api.sh http://127.0.0.1:8099` for the full curl demonstration against the running server. Run `npm test` for the regression suite with temporary databases.
