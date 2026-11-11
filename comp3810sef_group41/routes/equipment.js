const router = require('express').Router();
const svc = require('../services/equipmentService');
const loans = require('../services/loanService');
const { normalize } = require('../helpers');
const fields = (body) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => key !== '_csrf'));
router.get('/', async (req, res) =>
  res.render('equipment/list', {
    title: 'Equipment',
    items: await svc.listEquipment(req.query),
    query: req.query,
  }),
);
router.get('/new', (req, res) =>
  res.render('equipment/form', {
    title: 'Add equipment',
    item: {},
    editing: false,
    error: null,
  }),
);
router.post('/', async (req, res, next) => {
  try {
    const item = await svc.createEquipment(fields(req.body));
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
router.get('/:id/edit', async (req, res) =>
  res.render('equipment/form', {
    title: 'Edit equipment',
    item: await svc.getEquipment(req.params.id),
    editing: true,
    error: null,
  }),
);
router.post('/:id/edit', async (req, res, next) => {
  try {
    await svc.updateEquipment(req.params.id, fields(req.body));
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
router.post('/:id/delete', async (req, res) => {
  await svc.deleteEquipment(req.params.id);
  res.redirect('/equipment');
});
router.post('/:id/maintenance', async (req, res) => {
  await svc.setMaintenance(req.params.id, req.body.status);
  res.redirect('/equipment/' + req.params.id);
});
router.get('/:id', async (req, res) =>
  res.render('equipment/detail', {
    title: 'Equipment details',
    item: await svc.getEquipment(req.params.id),
    loans: await loans.listLoans({ equipmentId: req.params.id }),
  }),
);
module.exports = router;
