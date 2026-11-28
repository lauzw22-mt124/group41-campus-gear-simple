/**
 * Equipment management page router.
 *
 * The routes call the same EquipmentService used by the JSON API and translate
 * the result into redirects and EJS renders.
 */

const AbstractRouter = require('./AbstractRouter');
const svc = require('../services/EquipmentService');
const loans = require('../services/LoanService');
const { normalize } = require('../helpers');

/**
 * Drops the CSRF hidden field before the service allow-list check runs.
 * @param {Record<string, unknown>} body URL-encoded form body.
 * @returns {Record<string, unknown>} Body without `_csrf`.
 */
const fields = (body) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => key !== '_csrf'));

class EquipmentRouter extends AbstractRouter {
  constructor() {
    super('Equipment pages');
  }

  /** @inheritdoc */
  register() {
    /** GET /equipment - list and filter equipment. */
    this.get('/', async (req, res) =>
      res.render('equipment/list', {
        title: 'Equipment',
        items: await svc.list(req.query),
        query: req.query,
      }),
    );

    /** GET /equipment/new - render the empty create form. */
    this.get('/new', (req, res) =>
      res.render('equipment/form', {
        title: 'Add equipment',
        item: {},
        editing: false,
        error: null,
      }),
    );

    /**
     * POST /equipment - create an asset.
     * Validation errors re-render the form with the submitted values.
     */
    this.post('/', async (req, res, next) => {
      try {
        const item = await svc.create(fields(req.body));
        res.redirect('/equipment/' + item.id);
      } catch (err) {
        const e = normalize(err);
        if (e.status >= 500) return next(err);
        res.status(e.status).render('equipment/form', {
          title: 'Add equipment',
          item: req.body,
          editing: false,
          error: e.message,
        });
      }
    });

    /** GET /equipment/:id/edit - render the edit form with the current values. */
    this.get('/:id/edit', async (req, res) =>
      res.render('equipment/form', {
        title: 'Edit equipment',
        item: await svc.get(req.params.id),
        editing: true,
        error: null,
      }),
    );

    /**
     * POST /equipment/:id/edit - replace editable fields.
     * Invalid input or a duplicate asset code re-renders the form with an error.
     */
    this.post('/:id/edit', async (req, res, next) => {
      try {
        await svc.update(req.params.id, fields(req.body));
        res.redirect('/equipment/' + req.params.id);
      } catch (err) {
        const e = normalize(err);
        if (e.status >= 500 || e.status === 404) return next(err);
        res.status(e.status).render('equipment/form', {
          title: 'Edit equipment',
          item: { ...req.body, _id: req.params.id },
          editing: true,
          error: e.message,
        });
      }
    });

    /** POST /equipment/:id/delete - delete an available asset without history. */
    this.post('/:id/delete', async (req, res) => {
      await svc.remove(req.params.id);
      res.redirect('/equipment');
    });

    /** POST /equipment/:id/maintenance - switch available <-> maintenance. */
    this.post('/:id/maintenance', async (req, res) => {
      await svc.setMaintenance(req.params.id, req.body.status);
      res.redirect('/equipment/' + req.params.id);
    });

    /** GET /equipment/:id - details plus the asset's loan history. */
    this.get('/:id', async (req, res) =>
      res.render('equipment/detail', {
        title: 'Equipment details',
        item: await svc.get(req.params.id),
        loans: await loans.list({ equipmentId: req.params.id }),
      }),
    );
  }
}

module.exports = EquipmentRouter;
