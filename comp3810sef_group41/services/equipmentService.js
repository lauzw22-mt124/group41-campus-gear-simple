const mongoose = require('mongoose');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');
const categories = Equipment.schema.path('category').enumValues;
const v = require('../helpers');
const { fail } = require('../helpers');
function payload(data) {
  v.allowed(data, ['assetCode', 'name', 'category', 'location', 'description']);
  const assetCode = v.text(data.assetCode, 'Asset code', { max: 32 }).toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(assetCode))
    fail(400, 'INVALID_INPUT', 'Asset codes must contain only letters, digits and hyphens.');
  return {
    assetCode,
    name: v.text(data.name, 'Name'),
    category: v.choice(data.category, categories, 'Category'),
    location: v.text(data.location, 'Location'),
    description: v.text(data.description, 'Notes', {
      required: false,
      max: 1000,
    }),
  };
}
async function listEquipment(query = {}) {
  v.filters(query, ['q', 'category', 'status']);
  const filter = {};
  const q = v.text(query.q, 'Keyword', { required: false, max: 80 });
  if (q) {
    const pattern = new RegExp(v.literal(q), 'i');
    filter.$or = [{ name: pattern }, { assetCode: pattern }];
  }
  if (query.category) filter.category = v.choice(query.category, categories, 'Category');
  if (query.status)
    filter.status = v.choice(query.status, ['available', 'borrowed', 'maintenance'], 'Status');
  return Equipment.find(filter).sort({ assetCode: 1 }).lean();
}
async function getEquipment(value) {
  const item = await Equipment.findById(v.id(value)).lean();
  if (!item) fail(404, 'NOT_FOUND', 'Equipment not found.');
  return item;
}
async function createEquipment(data) {
  return Equipment.create(payload(data));
}
async function updateEquipment(value, data) {
  const item = await Equipment.findByIdAndUpdate(
    v.id(value),
    { $set: payload(data) },
    { new: true, runValidators: true },
  );
  if (!item) fail(404, 'NOT_FOUND', 'Equipment not found.');
  return item;
}
async function deleteEquipment(value) {
  v.id(value);
  await mongoose.connection.transaction(async (session) => {
    const item = await Equipment.findById(value).session(session);
    if (!item) fail(404, 'NOT_FOUND', 'Equipment not found.');
    if (item.status !== 'available')
      fail(409, 'NOT_AVAILABLE', 'Only available equipment can be deleted.');
    if (await Loan.exists({ equipmentId: value }).session(session))
      fail(409, 'HAS_LOAN_HISTORY', 'Equipment with loan history cannot be deleted.');
    await Equipment.deleteOne({ _id: value, status: 'available' }).session(session);
  });
}
async function setMaintenance(value, target) {
  v.id(value);
  v.choice(target, ['available', 'maintenance'], 'Maintenance state');
  const from = target === 'maintenance' ? 'available' : 'maintenance';
  const item = await Equipment.findOneAndUpdate(
    { _id: value, status: from },
    { $set: { status: target } },
    { new: true },
  );
  if (!item) {
    await getEquipment(value);
    fail(409, 'INVALID_TRANSITION', 'The current equipment state does not allow this operation.');
  }
  return item;
}
module.exports = {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  setMaintenance,
};
