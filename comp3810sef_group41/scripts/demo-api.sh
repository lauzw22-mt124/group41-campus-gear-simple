#!/usr/bin/env bash
# Run against a disposable course demonstration database. History is retained.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8099}"
BASE="${BASE%/}"
PREFIX="CURL-$(date +%s)-$$"
TMP_RESPONSE="$(mktemp)"
trap 'rm -f "$TMP_RESPONSE"' EXIT
COOKIE_ARGS=(-b '')
if [[ -n "${COOKIE_JAR:-}" ]]; then COOKIE_ARGS=(-b "$COOKIE_JAR"); fi

request() {
  local expected="$1" method="$2" path="$3" data="${4:-}" status
  printf '\n>>> curl -X %s %s%s\n' "$method" "$BASE" "$path"
  if [[ "$method" == 'POST' || "$method" == 'PUT' ]]; then
    printf 'JSON: %s\n' "$data"
    status=$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
      "${COOKIE_ARGS[@]}" -o "$TMP_RESPONSE" -w '%{http_code}' -X "$method" \
      "$BASE$path" -H 'Content-Type: application/json' --data "$data")
  else
    status=$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
      "${COOKIE_ARGS[@]}" -o "$TMP_RESPONSE" -w '%{http_code}' -X "$method" "$BASE$path")
  fi
  printf 'HTTP %s\n' "$status"
  if [[ -s "$TMP_RESPONSE" ]]; then
    node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8"); try {console.log(JSON.stringify(JSON.parse(s),null,2))} catch {console.log(s)}' "$TMP_RESPONSE"
  fi
  if [[ "$status" != "$expected" ]]; then
    printf 'Expected %s, received %s. Demonstration stopped.\n' "$expected" "$status" >&2
    exit 1
  fi
}
record_id() {
  node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!j.data?._id)process.exit(1); console.log(j.data._id)' "$TMP_RESPONSE"
}

request 200 GET /health
request 201 POST /api/equipment "{\"assetCode\":\"$PREFIX\",\"name\":\"Curl Projector\",\"category\":\"projector\",\"location\":\"Demo Room A\",\"description\":\"Fictional curl demonstration\"}"
ASSET_ID="$(record_id)"
request 200 GET "/api/equipment/$ASSET_ID"
request 200 PUT "/api/equipment/$ASSET_ID" "{\"assetCode\":\"$PREFIX\",\"name\":\"Curl Projector\",\"category\":\"projector\",\"location\":\"Demo Room B\",\"description\":\"Location updated with PUT\"}"
request 200 GET "/api/equipment?q=$PREFIX&category=projector&status=available"
request 200 PUT "/api/equipment/$ASSET_ID/maintenance" '{"status":"maintenance"}'
BORROW_BODY="{\"equipmentId\":\"$ASSET_ID\",\"borrowerName\":\"Demo Student\",\"borrowerId\":\"DEMO41\",\"notes\":\"Synthetic demonstration only\"}"
request 409 POST /api/loans "$BORROW_BODY"
request 200 PUT "/api/equipment/$ASSET_ID/maintenance" '{"status":"available"}'
request 201 POST /api/loans "$BORROW_BODY"
LOAN_ID="$(record_id)"
request 409 POST /api/loans "$BORROW_BODY"
request 200 GET '/api/loans?borrower=DEMO41&status=active'
request 200 GET "/api/loans?equipmentId=$ASSET_ID"
request 200 PUT "/api/loans/$LOAN_ID/return" '{}'
request 409 PUT "/api/loans/$LOAN_ID/return" '{}'
request 409 DELETE "/api/equipment/$ASSET_ID"
request 201 POST /api/equipment "{\"assetCode\":\"$PREFIX-DEL\",\"name\":\"Unused Demo Tripod\",\"category\":\"tripod\",\"location\":\"Demo Room\"}"
DELETE_ID="$(record_id)"
request 204 DELETE "/api/equipment/$DELETE_ID"
request 404 GET "/api/equipment/$DELETE_ID"
printf '\nAll curl demonstrations passed. Retained equipment %s and returned loan %s as history.\n' "$ASSET_ID" "$LOAN_ID"
