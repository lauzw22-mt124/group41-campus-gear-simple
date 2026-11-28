/**
 * Loan page router.
 *
 * Checkout and return call the same LoanService used by the JSON API; the
 * service owns the equipment/loan state transition inside a transaction.
 */

const AbstractRouter = require('./AbstractRouter');
const svc = require('../services/LoanService');
const equipment = require('../services/EquipmentService');

class LoanRouter extends AbstractRouter {
  constructor() {
    super('Loan pages');
  }

  /** @inheritdoc */
  register() {
    /** GET /loans - list loans with optional borrower/status filters. */
    this.get('/', async (req, res) =>
      res.render('loans/list', {
        title: 'Loans',
        loans: await svc.list(req.query),
        query: req.query,
      }),
    );

    /** GET /loans/new?equipmentId=... - render the checkout form for one asset. */
    this.get('/new', async (req, res) => {
      const item = await equipment.get(req.query.equipmentId);
      res.render('loans/form', { title: 'Check out', item });
    });

    /**
     * POST /loans - check out an asset.
     * `datetime-local` input is interpreted as Hong Kong time (+08:00).
     */
    this.post('/', async (req, res) => {
      const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => key !== '_csrf'));
      if (data.dueAt) data.dueAt += '+08:00';
      await svc.borrow(data, req.user._id);
      res.redirect('/loans?status=active');
    });

    /** POST /loans/:id/return - return an active loan. */
    this.post('/:id/return', async (req, res) => {
      await svc.returnLoan(req.params.id);
      res.redirect('/loans');
    });
  }
}

module.exports = LoanRouter;
