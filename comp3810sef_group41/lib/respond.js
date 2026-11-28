/**
 * JSON response envelopes used by the API routes.
 * Successful payloads are `{ data: ... }`; deletions are `{ ok: true }`.
 * Errors are handled centrally by the global error handler.
 */

/**
 * Sends a 200 response with a data envelope.
 * @param {import('express').Response} res Express response.
 * @param {unknown} data Payload to serialize.
 * @returns {import('express').Response}
 */
function sendData(res, data) {
  return res.json({ data });
}

/**
 * Sends a 201 response with a data envelope.
 * @param {import('express').Response} res Express response.
 * @param {unknown} data Newly created resource.
 * @returns {import('express').Response}
 */
function sendCreated(res, data) {
  return res.status(201).json({ data });
}

/**
 * Sends a 200 response confirming a deletion.
 * @param {import('express').Response} res Express response.
 * @returns {import('express').Response}
 */
function sendDeleted(res) {
  return res.json({ ok: true });
}

module.exports = { sendData, sendCreated, sendDeleted };
