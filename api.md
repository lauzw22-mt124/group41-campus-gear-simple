# Campus Gear API

Base URL: `http://127.0.0.1:8099`. Responses are JSON. `POST` and `PUT` require `Content-Type: application/json`. In local mode (`API_AUTH_REQUIRED=false`) no login is required; with `API_AUTH_REQUIRED=true`, send the signed-in session cookie. IDs are 24-character hexadecimal strings.

## Health

`GET /health`

```
200 {"status":"ok"}
503 {"status":"unavailable"}
```

## Equipment

### List

`GET /api/equipment?q=&category=&status=`

All parameters optional. `category`: `projector | microphone | tripod`. `status`: `available | borrowed | maintenance`.

```
200 {"data":[Equipment, ...]}
```

### Get

`GET /api/equipment/:id`
`GET /api/equipment/by-code/:assetCode`

```
200 {"data":Equipment}
```

### Create

`POST /api/equipment`

```json
{
  "assetCode": "PROJ-001",
  "name": "Portable Projector",
  "category": "projector",
  "location": "Room A",
  "description": "HDMI cable included"
}
```

Required: `assetCode`, `name`, `category`, `location`. `description` optional.

```
201 {"data":Equipment}
```

### Update

`PUT /api/equipment/:id`
`PUT /api/equipment/by-code/:assetCode`

Body: same fields as create (full replacement).

```
200 {"data":Equipment}
```

### Delete

`DELETE /api/equipment/:id`
`DELETE /api/equipment/by-code/:assetCode`

```
200 {"ok":true}
```

### Maintenance

`PUT /api/equipment/:id/maintenance`

```json
{"status":"maintenance"}
```

or

```json
{"status":"available"}
```

```
200 {"data":Equipment}
```

## Loans

### Borrow

`POST /api/loans`

```json
{
  "equipmentId": "24-hex-id",
  "borrowerName": "Chris Wong",
  "borrowerId": "S41001",
  "dueAt": "2026-12-01T18:00:00+08:00",
  "notes": "Optional"
}
```

`dueAt` and `notes` optional. `dueAt` is a future ISO timestamp with a time zone.

```
201 {"data":Loan}
```

### Search

`GET /api/loans?borrower=&status=&equipmentId=`

All parameters optional. `status`: `active | returned`.

```
200 {"data":[Loan, ...]}
```

### Return

`PUT /api/loans/:id/return`

```json
{}
```

```
200 {"data":Loan}
```

## Objects

### Equipment

```json
{
  "_id": "24-hex-id",
  "assetCode": "PROJ-001",
  "name": "Portable Projector",
  "category": "projector",
  "location": "Room A",
  "status": "available",
  "description": "",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

### Loan

```json
{
  "_id": "24-hex-id",
  "equipmentId": "24-hex-id or Equipment object",
  "borrowerName": "Chris Wong",
  "borrowerId": "S41001",
  "borrowedAt": "ISO 8601",
  "dueAt": "ISO 8601 or null",
  "returnedAt": "ISO 8601 or null",
  "status": "active",
  "handledBy": "24-hex-id or null",
  "notes": "",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

## Errors

```json
{"error":{"code":"NOT_FOUND","message":"Equipment not found."}}
```

| HTTP | Codes |
| --- | --- |
| 400 | `INVALID_INPUT`, `INVALID_ID`, `INVALID_DATE`, `INVALID_QUERY`, `UNKNOWN_FIELD`, `INVALID_JSON` |
| 401 | `AUTH_REQUIRED` |
| 404 | `NOT_FOUND` |
| 409 | `DUPLICATE`, `NOT_AVAILABLE`, `INVALID_TRANSITION`, `ALREADY_RETURNED`, `HAS_LOAN_HISTORY`, `INCONSISTENT_STATE` |
| 413 | `TOO_LARGE` |
| 415 | `JSON_REQUIRED` |
| 500 | `INTERNAL_ERROR` |
