const router = require('express').Router();
const svc = require('../services/loanService');
const equipment = require('../services/equipmentService');
router.get('/', async (req, res) =>
  res.render('loans/list', {
    title: 'Loans',
    loans: await svc.listLoans(req.query),
    query: req.query,
  }),
);
router.get('/new', async (req, res) => {
  const item = await equipment.getEquipment(req.query.equipmentId);
  res.render('loans/form', { title: 'Check out', item });
});
router.post('/', async (req, res) => {
  const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => key !== '_csrf'));
  if (data.dueAt) data.dueAt += '+08:00';
  await svc.borrowEquipment(data, req.user._id);
  res.redirect('/loans?status=active');
});
router.post('/:id/return', async (req, res) => {
  await svc.returnEquipment(req.params.id);
  res.redirect('/loans');
});
module.exports = router;
