/**
 * JSON API router.
 *
 * Endpoint classes extend {@link AbstractRouter}; handlers stay thin because
 * the service classes own validation, business rules and persistence.
 * Responses use the envelopes from `lib/respond.js` and errors are translated
 * by `middleware/errorHandler.js`.
 */

const AbstractRouter = require('./AbstractRouter');
const equipment = require('../services/EquipmentService');
const loans = require('../services/LoanService');
const { fail, allowed } = require('../helpers');
const { sendData, sendCreated, sendDeleted } = require('../lib/respond');

/** Both the database-ID and asset-code lookups share the same handlers. */
const equipmentPaths = ['/equipment/:id', '/equipment/by-code/:assetCode'];

/**
 * Converts route params into the key shape expected by EquipmentService.
 * @param {Record<string, string>} params Express route params.
 * @returns {string|{assetCode: string}} Database ID or asset-code key.
 */
function equipmentKey(params) {
  return params.assetCode === undefined ? params.id : { assetCode: params.assetCode };
}

class ApiRouter extends AbstractRouter {
  constructor() {
    super('API');
  }

  /** @inheritdoc */
  register() {
    /**
     * Request guard for every API route: optional session authentication
     * (`API_AUTH_REQUIRED=true`) and a JSON content type for write requests.
     */
    this.use((req, res, next) => {
      if (req.app.locals.apiAuthRequired && !req.user)
        fail(401, 'AUTH_REQUIRED', 'Please sign in first.');
      if (['POST', 'PUT'].includes(req.method) && !req.is('application/json'))
        fail(415, 'JSON_REQUIRED', 'Use an application/json request body.');
      next();
    });

    /** GET /api/equipment - list equipment with optional keyword/category/status filters. */
    this.get('/equipment', async (req, res) =>
      sendData(res, await equipment.list(req.query)),
    );

    /** GET /api/equipment/:id or /api/equipment/by-code/:assetCode - read one asset. */
    this.get(equipmentPaths, async (req, res) =>
      sendData(res, await equipment.get(equipmentKey(req.params))),
    );

    /** POST /api/equipment - create an equipment record. */
    this.post('/equipment', async (req, res) => sendCreated(res, await equipment.create(req.body)));

    /** PUT /api/equipment/:id or /api/equipment/by-code/:assetCode - replace editable fields. */
    this.put(equipmentPaths, async (req, res) =>
      sendData(res, await equipment.update(equipmentKey(req.params), req.body)),
    );

    /** DELETE /api/equipment/:id or /api/equipment/by-code/:assetCode - delete an unused asset. */
    this.delete(equipmentPaths, async (req, res) => {
      await equipment.remove(equipmentKey(req.params));
      sendDeleted(res);
    });

    /** PUT /api/equipment/:id/maintenance - switch between available and maintenance. */
    this.put('/equipment/:id/maintenance', async (req, res) => {
      allowed(req.body, ['status']);
      sendData(res, await equipment.setMaintenance(req.params.id, req.body.status));
    });

    /** GET /api/loans - list loans with optional borrower/status/equipment filters. */
    this.get('/loans', async (req, res) => sendData(res, await loans.list(req.query)));

    /** POST /api/loans - check out an available asset and create an active loan. */
    this.post('/loans', async (req, res) =>
      sendCreated(res, await loans.borrow(req.body, req.user?._id || null)),
    );

    /** PUT /api/loans/:id/return - return an active loan and free the equipment. */
    this.put('/loans/:id/return', async (req, res) => {
      allowed(req.body, []);
      sendData(res, await loans.returnLoan(req.params.id));
    });

    /** Fallback for unknown API endpoints. */
    this.use((req, res) => fail(404, 'NOT_FOUND', 'Endpoint not found.'));
  }
}

module.exports = ApiRouter;
