# REST API guide

Base URL: `http://127.0.0.1:8099`. All responses are JSON except successful DELETE (empty 204). `POST` and `PUT` require `Content-Type: application/json`. Object IDs are 24-character hexadecimal strings. Unknown input fields/query parameters are rejected.

The local course mode (API_AUTH_REQUIRED=false) allows API requests without authentication. If `API_AUTH_REQUIRED=true`, obtain a normal web session and send its cookie; see the authenticated curl steps below. No CORS allowance is configured.

## Equipment representation

```json
{
  "_id": "a MongoDB ObjectId",
  "assetCode": "DEMO-101",
  "name": "Portable Projector",
  "category": "projector",
  "location": "Club Room A",
  "status": "available",
  "description": "HDMI cable included",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

`assetCode` is unique, uppercased, at most 32 characters, and contains letters, digits and hyphens only. `name` and `location` are required (120 characters maximum). `category` is `projector`, `microphone` or `tripod`. `description` is optional (1,000 characters maximum). `status`, timestamps and IDs cannot be set through the create/update payload.

Success envelope: `{"data": object}` or `{"data": [objects]}`. Error envelope: `{"error":{"code":"NOT_AVAILABLE","message":"..."}}`. Extra MongoDB fields such as `__v` may be present.

## Copyable curl commands

Run these in Bash. Replace `ASSET_ID` and `LOAN_ID` with actual IDs from prior responses. The automated [demo script](../scripts/demo-api.sh) captures IDs for you.

```bash
BASE=http://127.0.0.1:8099

# CREATE (201)
curl -i -X POST "$BASE/api/equipment" -H 'Content-Type: application/json' \
  -d '{"assetCode":"DEMO-101","name":"Portable Projector","category":"projector","location":"Club Room A","description":"HDMI cable included"}'

# READ list and combined filters (200)
curl -i "$BASE/api/equipment"
curl -i "$BASE/api/equipment?q=DEMO&category=projector&status=available"
curl -i "$BASE/api/equipment/ASSET_ID"

# UPDATE (200): send all required editable fields, not just a single changed field
curl -i -X PUT "$BASE/api/equipment/ASSET_ID" -H 'Content-Type: application/json' \
  -d '{"assetCode":"DEMO-101","name":"Portable Projector","category":"projector","location":"Cabinet B","description":"Checked before lending"}'

# Maintenance and restore (200)
curl -i -X PUT "$BASE/api/equipment/ASSET_ID/maintenance" \
  -H 'Content-Type: application/json' -d '{"status":"maintenance"}'
curl -i -X PUT "$BASE/api/equipment/ASSET_ID/maintenance" \
  -H 'Content-Type: application/json' -d '{"status":"available"}'

# Borrow (201); dueAt and notes are optional
curl -i -X POST "$BASE/api/loans" -H 'Content-Type: application/json' \
  -d '{"equipmentId":"ASSET_ID","borrowerName":"Demo Student","borrowerId":"DEMO41","notes":"Presentation rehearsal"}'

# Loan searches (200). equipmentId is populated in this response.
curl -i "$BASE/api/loans?borrower=DEMO41&status=active"
curl -i "$BASE/api/loans?equipmentId=ASSET_ID"

# Return (200)
curl -i -X PUT "$BASE/api/loans/LOAN_ID/return" \
  -H 'Content-Type: application/json' -d '{}'

# DELETE (204): use a DIFFERENT available asset that has NEVER been borrowed
curl -i -X DELETE "$BASE/api/equipment/UNUSED_ASSET_ID"
```

## Query rules

- Equipment: `q` performs a literal case-insensitive substring search of asset code/name. It does not execute user-provided regular expressions. `category` and `status` match exact enum values; conditions combine with AND.
- Loans: `borrower` searches name or borrower ID case-insensitively, `status` is `active` or `returned`, and `equipmentId` limits results to one asset.
- Maximum keyword/borrower length is 80. No pagination is included; this implementation targets a small campus register.
- Display times use Asia/Hong_Kong. JSON stores UTC timestamps. Optional `dueAt` must be a future ISO date-time with explicit `Z` or offset, for example `2027-01-20T18:00:00+08:00`.
- Borrower name is required (80 characters maximum); borrower ID is required (40); optional loan notes accept 1,000 characters. Borrow/return time and status are server-controlled.

## HTTP errors

| Status    | Typical codes                                                                                   | Cause                                                                              |
| --------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 400       | `INVALID_INPUT`, `INVALID_ID`, `INVALID_QUERY`, `UNKNOWN_FIELD`, `INVALID_DATE`, `INVALID_JSON` | Invalid values, unsupported fields/filters or malformed JSON.                      |
| 401       | `AUTH_REQUIRED`                                                                                 | Optional authenticated API mode is enabled and no valid session is present.        |
| 403       | `CSRF`                                                                                          | Invalid web form token; API routes use JSON and do not require the web form token. |
| 404       | `NOT_FOUND`                                                                                     | Record or endpoint does not exist.                                                 |
| 409       | `DUPLICATE`                                                                                     | Duplicate asset code or active-loan unique-index conflict.                         |
| 409       | `NOT_AVAILABLE`, `INVALID_TRANSITION`, `ALREADY_RETURNED`                                       | Operation conflicts with the current state.                                        |
| 409       | `HAS_LOAN_HISTORY`, `INCONSISTENT_STATE`                                                        | History prevents deletion or a return was rolled back due to inconsistent data.    |
| 413 / 415 | `TOO_LARGE` / `JSON_REQUIRED`                                                                   | Body exceeds 20 KB / incorrect media type.                                         |
| 500       | `INTERNAL_ERROR`                                                                                | Unexpected server/database failure; inspect server logs.                           |

Login is rate limited to 20 attempts per 15 minutes per IP. A failed web login shows a page; unauthenticated web requests redirect to `/login`. These are distinct from JSON API errors.

## Curl when API authentication is enabled

Use a local cookie file outside the repository. Substitute the actual account password below; avoid saving a production password in command history or a shared script.

```bash
# Obtain login form and session token.
curl -sS -c /tmp/group41.cookies "$BASE/login" -o /tmp/group41-login.html
TOKEN=$(node -e 'const s=require("fs").readFileSync("/tmp/group41-login.html","utf8"); console.log(s.match(/name="_csrf" value="([^"]+)"/)[1])')
# Read the password interactively instead of embedding it in this file.
read -r -s -p 'Administrator password: ' LOGIN_PASSWORD; printf '\n'
curl -sS -b /tmp/group41.cookies -c /tmp/group41.cookies -X POST "$BASE/login" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode 'username=admin41' \
  --data-urlencode "password=$LOGIN_PASSWORD" -o /dev/null
unset LOGIN_PASSWORD
COOKIE_JAR=/tmp/group41.cookies bash scripts/demo-api.sh "$BASE"
rm -f /tmp/group41.cookies /tmp/group41-login.html
```

Protect the session cookie as a credential. `API_AUTH_REQUIRED=true` changes API access only; it never disables authentication on the web pages.
