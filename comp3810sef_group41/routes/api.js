const router = require('express').Router();
const equipment = require('../services/equipmentService');
const loans = require('../services/loanService');
const { fail } = require('../helpers');
router.use((req, res, next) => {
  if (req.app.locals.apiAuthRequired && !req.user)
    fail(401, 'AUTH_REQUIRED', 'Please sign in first.');
  if (['POST', 'PUT'].includes(req.method) && !req.is('application/json'))
    fail(415, 'JSON_REQUIRED', 'Use an application/json request body.');
  next();
});
router.get('/equipment', async (req, res) =>
  res.json({ data: await equipment.listEquipment(req.query) }),
);
const equipmentPaths = ['/equipment/:id', '/equipment/by-code/:assetCode'];
function equipmentKey(params) {
  return params.assetCode === undefined ? params.id : { assetCode: params.assetCode };
}
router.get(equipmentPaths, async (req, res) =>
  res.json({ data: await equipment.getEquipment(equipmentKey(req.params)) }),
);
router.post('/equipment', async (req, res) =>
  res.status(201).json({ data: await equipment.createEquipment(req.body) }),
);
router.put(equipmentPaths, async (req, res) =>
  res.json({ data: await equipment.updateEquipment(equipmentKey(req.params), req.body) }),
);
router.delete(equipmentPaths, async (req, res) => {
  await equipment.deleteEquipment(equipmentKey(req.params));
  res.json({ ok: true });
});
router.put('/equipment/:id/maintenance', async (req, res) => {
  require('../helpers').allowed(req.body, ['status']);
  res.json({
    data: await equipment.setMaintenance(req.params.id, req.body.status),
  });
});
router.get('/loans', async (req, res) => res.json({ data: await loans.listLoans(req.query) }));
router.post('/loans', async (req, res) =>
  res.status(201).json({
    data: await loans.borrowEquipment(req.body, req.user?._id || null),
  }),
);
router.put('/loans/:id/return', async (req, res) => {
  require('../helpers').allowed(req.body, []);
  res.json({ data: await loans.returnEquipment(req.params.id) });
});
router.use((req, res) => fail(404, 'NOT_FOUND', 'Endpoint not found.'));
module.exports = router;
