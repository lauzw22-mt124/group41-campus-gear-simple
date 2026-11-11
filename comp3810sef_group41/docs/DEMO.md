# Presentation and code walkthrough

## Ten-minute demonstration

Use the actual assigned roles and contributions. Keep the website, a terminal and this short guide open; do not browse every repository file. Install dependencies and download MongoDB by running the app once before class; prepare the curl commands. Present on local Ubuntu and follow the current course presentation-sheet instructions.

| Time       | Role | Show                                                                                               |
| ---------- | ---- | -------------------------------------------------------------------------------------------------- |
| 0:00–1:15  | A    | Purpose, six members/roles, `npm start`, local server address and login.                                                 |
| 1:15–3:00  | C    | Add equipment, combine search filters, edit location, delete a separate unused asset.              |
| 3:00–5:00  | D    | Check out, search by borrower, return, maintenance and restore.                                    |
| 5:00–7:15  | E    | Run `bash scripts/demo-api.sh`; explain POST, GET, PUT and DELETE plus loan/maintenance endpoints. |
| 7:15–8:30  | B    | Show the three models and trace the transaction/unique-index protection.                           |
| 8:30–9:30  | F    | Explain test evidence and the simple EJS interface; show one rejected invalid operation.           |
| 9:30–10:00 | A    | Sign out, verify protected access and keep a short time buffer.                                    |

Use fictional borrower details. The Delete example must be an Available asset with no history. In the curl script, 409 is the expected result for a prohibited transition, not a crash.

## Local rehearsal checklist

1. On the presentation laptop, run `npm start` once with Internet available to cache MongoDB. Sign in and prepare fictional sample records.
2. Stop with Ctrl+C, disconnect Internet if desired, and start again. Check that saved records remain.
3. Keep the server terminal open and open `http://127.0.0.1:8099` in the browser.
4. Use a second terminal in `comp3810sef_group41` for `bash scripts/demo-api.sh`.
5. Explain that GitHub shares source code; the website and database run on this laptop. No Docker or cloud deployment is used.

## Read the code in this order

1. **`models/Equipment.js` and `models/Loan.js`** — identify fields, references and statuses.
2. **`services/loanService.js`** — trace one successful checkout and return.
3. **`routes/loans.js`** — see how a form supplies the service's inputs and then redirects.
4. **`views/loans/form.ejs`** — match input `name` attributes to `req.body` fields.
5. **`routes/api.js`** — find the same service call returning JSON instead of HTML.
6. **`server.js`, `routes/auth.js`, `middleware/auth.js`** — explain setup, session login and authorization.

Equipment CRUD follows the same pattern in its route, service and views. `helpers.js` centralizes validation and error responses so the rules are not copied into both web and API routes.

```text
Browser form -> web route --+
                           +-> service -> Mongoose model -> MongoDB
curl JSON   -> API route ---+
```

## Trace a checkout

- The EJS form posts equipmentId, borrowerName and borrowerId (plus optional dueAt/notes).
- The route removes the CSRF form field and calls `borrowEquipment`.
- The service validates inputs before starting a transaction.
- `findOneAndUpdate({_id, status: 'available'}, ...)` claims only an Available asset.
- The service creates an Active loan in the same transaction. If creation fails, the equipment change rolls back.
- The unique partial index permits only one Active loan per equipmentId, even under simultaneous requests.
- The web route redirects to Loans; the API route returns 201 and the loan as JSON.

## Questions to practise

| Question                                | Key idea and file                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Why one document per asset?             | Each physical projector has its own code/state/history; `models/Equipment.js`.                                              |
| What is ObjectId / populate?            | The loan stores an equipment reference; populate loads its details for display; `services/loanService.js`.                  |
| What does async/await do?               | Waits for database/password operations. Express 5 forwards rejected async routes to the error handler.                      |
| Why a transaction?                      | Loan insertion and asset status must commit together or both roll back.                                                     |
| Why a unique partial index as well?     | It enforces one Active loan per asset in MongoDB, while allowing many Returned loans.                                       |
| Why not only hide the Check out button? | Clients can send requests directly; the service must enforce availability.                                                  |
| Why not let the edit form set status?   | Status changes must go through borrow/return/maintenance rules; `equipmentService.js`.                                      |
| Why cannot every asset be deleted?      | History must retain its equipment reference. Delete is still available for never-loaned Available assets.                   |
| How is login remembered?                | A signed session-ID cookie identifies a MongoDB-backed session containing userId. Login regenerates it; logout destroys it. |
| What is a CSRF token?                   | A random session value checked on web form writes; `middleware/auth.js`.                                                    |
| Why hash passwords?                     | The database stores a bcrypt hash instead of the original password; seed/auth files.                                        |
| What are `<%`, `<%=`, `<%-`?            | Execute template code; output escaped text; output raw HTML. Use raw output only for trusted partial includes.              |
| What does PUT do here?                  | Replaces all editable equipment fields; the client supplies all required fields.                                            |
| Why services?                           | Both web and API routes call one set of business rules.                                                                     |
| Why a replica-set database?             | Multi-document transactions need it; database.js creates a one-node replica set on this computer.                                                        |

The database launcher package is named `mongodb-memory-server`, but this application starts a real `mongod` executable with WiredTiger and an explicit `.local-data/mongodb` directory. `disconnect()` stops it with cleanup disabled, so it preserves data. The restart regression test verifies this behavior.

## Each member's preparation

| Role | Must be able to explain                                        | Example independent work to record                     |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------ |
| A    | Local startup, middleware order, sessions and login/logout | Run on the presentation machine; improve a login case. |
| B    | All three schemas, reference and indexes                       | Inspect stored records and verify a schema constraint. |
| C    | Form input → route → CRUD result                               | Improve an equipment form or query with a test.        |
| D    | Borrow/return transaction and state changes                    | Test concurrent checkout and a failed return.          |
| E    | Each endpoint/method/payload/status                            | Modify and explain a curl scenario.                    |
| F    | EJS loops/escaping, CSS layout and tests                       | Verify narrow screens and improve a page or test.      |

These examples are tasks to perform, not claims that anyone has completed them. Explain actual contributions honestly. The initial reference and simplification were Agent-assisted; reducing file count does not replace independent student work under the course rules.

| Member                         | Actual PR / commit | Work explained and tested | Date |
| ------------------------------ | ------------------ | ------------------------- | ---- |
| To be completed by each member | —                  | —                         | —    |
