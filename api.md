# Campus Gear API

Run the server with `npm start` and run the examples in a second Ubuntu terminal. Each command prints the status, headers and JSON body. The local demo uses `API_AUTH_REQUIRED=false`. In authenticated mode, sign in and pass the session cookie with each API request as described in the [authentication guide](comp3810sef_group41/docs/API.md#curl-when-api-authentication-is-enabled).

## Equipment CRUD by asset code

Run these four commands in order with an unused code. Codes are unique, case-insensitive and stored in uppercase. Each URL identifies one exact code. The response includes MongoDB IDs, but these four operations only require the asset code.

| Step | Success | Response body |
| --- | --- | --- |
| Create | 201 Created | `{"data": Equipment}` with status `available` |
| Read | 200 OK | `{"data": Equipment}` |
| Update | 200 OK | `{"data": Equipment}` with the saved fields |
| Delete | 200 OK | `{"ok":true}` where `ok` is a JSON boolean |

```bash
curl -i -X POST 'http://127.0.0.1:8099/api/equipment' --json '{"assetCode":"DOC-001","name":"Demo Tripod","category":"tripod","location":"Room A"}'
curl -i 'http://127.0.0.1:8099/api/equipment/by-code/DOC-001'
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/by-code/DOC-001' --json '{"assetCode":"DOC-001","name":"Demo Tripod","category":"tripod","location":"Room B"}'
curl -i -X DELETE 'http://127.0.0.1:8099/api/equipment/by-code/DOC-001'
```

POST and PUT require `assetCode`, `name`, `category` and `location`. An omitted `description` becomes an empty string. To rename an asset, send the new code in the PUT body and use the old code in the URL. Later requests use the new code. Only an available asset with no loan history can be deleted. A second DELETE for a removed asset returns 404.

The following routes accept a 24-character hexadecimal database ID. They use the same payloads, success responses and rules as the corresponding by-code routes. Replace `ASSET_ID` with a real equipment ID.

```bash
curl -i 'http://127.0.0.1:8099/api/equipment/ASSET_ID'
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID' --json '{"assetCode":"DOC-001","name":"Demo Tripod","category":"tripod","location":"Room B"}'
curl -i -X DELETE 'http://127.0.0.1:8099/api/equipment/ASSET_ID'
```

## Health and equipment search

```bash
curl -i 'http://127.0.0.1:8099/health'
curl -i 'http://127.0.0.1:8099/api/equipment'
curl -i 'http://127.0.0.1:8099/api/equipment?q=projector&category=projector&status=available'
```

Health returns 200 and `{"status":"ok"}`. Both list requests return 200 and `{"data":[Equipment, ...]}`, sorted by asset code. An empty result is `{"data":[]}`. All filters are optional and combine with AND. The keyword `q` matches part of the asset code or name, ignoring case (maximum 80 characters). Category and status use the enum values below.

## Maintenance

Choose an available asset from the equipment list. Replace `ASSET_ID` with its `_id`. Both calls return 200 and `{"data": Equipment}` with the updated status. A disallowed transition returns 409.

```bash
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID/maintenance' --json '{"status":"maintenance"}'
curl -i -X PUT 'http://127.0.0.1:8099/api/equipment/ASSET_ID/maintenance' --json '{"status":"available"}'
```

## Loans

**Borrow.** Supply the equipment ID, borrower name and borrower ID. Optional fields are `notes` and `dueAt` (a future ISO timestamp including a time zone). Success returns 201 and `{"data": Loan}`. The equipment becomes borrowed. Save the loan's own `data._id` as `LOAN_ID` for the return.

```bash
curl -i -X POST 'http://127.0.0.1:8099/api/loans' --json '{"equipmentId":"ASSET_ID","borrowerName":"Chris Demo","borrowerId":"DEMO41"}'
```

**Search.** All filters are optional. `borrower` matches part of the name or borrower ID, ignoring case (maximum 80 characters). `status` accepts `active` or `returned`. `equipmentId` filters by equipment database ID. Success returns 200 and `{"data":[Loan, ...]}`, newest first. Each result includes the linked equipment object in `equipmentId`. An empty result is `{"data":[]}`.

```bash
curl -i 'http://127.0.0.1:8099/api/loans'
curl -i 'http://127.0.0.1:8099/api/loans?borrower=DEMO41&status=active'
curl -i 'http://127.0.0.1:8099/api/loans?equipmentId=ASSET_ID'
```

**Return.** Send an empty JSON object to return an active loan. Success returns 200 and `{"data": Loan}` with status `returned` and a recorded return time. The equipment becomes available. Returning the same loan again yields 409.

```bash
curl -i -X PUT 'http://127.0.0.1:8099/api/loans/LOAN_ID/return' --json '{}'
```

## JSON field types

All IDs serialize as hexadecimal strings. Dates serialize as UTC ISO 8601 strings. MongoDB may include a numeric `__v` version field.

| Equipment field | JSON type | Meaning or allowed value |
| --- | --- | --- |
| `_id` | string | Generated equipment ID |
| `assetCode` | string | 1–32 letters, digits or hyphens |
| `name`, `location` | string | Required, maximum 120 characters each |
| `category` | string | `projector`, `microphone`, `tripod` |
| `description` | string | Optional notes, maximum 1,000 characters |
| `status` | string | `available`, `borrowed`, `maintenance` |
| `createdAt`, `updatedAt` | string | Creation and last update times |

| Loan field | JSON type | Meaning or allowed value |
| --- | --- | --- |
| `_id` | string | Generated loan ID |
| `equipmentId` | string on borrow/return, object on search | ID or populated Equipment |
| `borrowerName`, `borrowerId` | string | Required, maximum 80 and 40 characters respectively |
| `status` | string | `active` or `returned` |
| `borrowedAt`, `createdAt`, `updatedAt` | string | Borrow, creation and update times |
| `dueAt`, `returnedAt` | string or null | Expected return and actual return times |
| `handledBy` | string or null | Administrator ID when available |
| `notes` | string | Optional notes, maximum 1,000 characters |

## Errors

API errors have an `error` object with two string fields. For example, querying a deleted asset returns HTTP 404:

```json
{"error":{"code":"NOT_FOUND","message":"Equipment not found."}}
```

| HTTP | Typical cause |
| --- | --- |
| 400 | Invalid ID, input, date, query or JSON |
| 401 | Session required in authenticated mode |
| 404 | Record or endpoint missing |
| 409 | Duplicate asset code, unavailable equipment, repeated return or protected loan history |
| 413 | Request body exceeds 20 KB |
| 415 | POST or PUT body lacks the JSON content type |
| 500 | Unexpected server error |

To exercise the endpoints and check their HTTP codes against a running demonstration database, run `bash scripts/demo-api.sh http://127.0.0.1:8099` from the application folder.
