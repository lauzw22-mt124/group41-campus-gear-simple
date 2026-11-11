const mongoose = require('mongoose');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');
const v = require('../helpers');
const { fail } = require('../helpers');
async function borrowEquipment(data, handledBy = null) {
  v.allowed(data, ['equipmentId', 'borrowerName', 'borrowerId', 'dueAt', 'notes']);
  const equipmentId = v.id(data.equipmentId);
  const fields = {
    equipmentId,
    borrowerName: v.text(data.borrowerName, 'Borrower name', { max: 80 }),
    borrowerId: v.text(data.borrowerId, 'Borrower ID', { max: 40 }),
    notes: v.text(data.notes, 'Notes', { required: false, max: 1000 }),
    handledBy,
  };
  if (data.dueAt) {
    const raw = v.text(data.dueAt, 'Expected return time', { max: 40 });
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw))
      fail(
        400,
        'INVALID_DATE',
        'Date must include a timezone, for example 2026-11-20T18:00:00+08:00.',
      );
    fields.dueAt = new Date(raw);
    if (isNaN(fields.dueAt) || fields.dueAt <= new Date())
      fail(400, 'INVALID_DATE', 'Expected return time must be in the future.');
  }
  // Both changes commit together, or both roll back.
  let result;
  await mongoose.connection.transaction(async (session) => {
    // Only an available asset can be claimed by this request.
    const item = await Equipment.findOneAndUpdate(
      { _id: equipmentId, status: 'available' },
      { $set: { status: 'borrowed' } },
      { new: true, session },
    );
    if (!item) {
      if (!(await Equipment.exists({ _id: equipmentId }).session(session)))
        fail(404, 'NOT_FOUND', 'Equipment not found.');
      fail(
        409,
        'NOT_AVAILABLE',
        'Equipment is borrowed or under maintenance and cannot be checked out.',
      );
    }
    // The partial unique index also prevents two active loans for one asset.
    [result] = await Loan.create([fields], { session });
  });
  return result;
}
// A second return must fail; it must not change a later loan.
async function returnEquipment(value) {
  v.id(value);
  let result;
  await mongoose.connection.transaction(async (session) => {
    result = await Loan.findOneAndUpdate(
      { _id: value, status: 'active' },
      { $set: { status: 'returned', returnedAt: new Date() } },
      { new: true, session },
    );
    if (!result) {
      if (!(await Loan.exists({ _id: value }).session(session)))
        fail(404, 'NOT_FOUND', 'Loan not found.');
      fail(409, 'ALREADY_RETURNED', 'This loan has already been returned.');
    }
    const item = await Equipment.findOneAndUpdate(
      { _id: result.equipmentId, status: 'borrowed' },
      { $set: { status: 'available' } },
      { new: true, session },
    );
    if (!item)
      fail(
        409,
        'INCONSISTENT_STATE',
        'Equipment and loan states do not match. This return was rolled back.',
      );
  });
  return result;
}
async function listLoans(query = {}) {
  v.filters(query, ['borrower', 'status', 'equipmentId']);
  const filter = {};
  const borrower = v.text(query.borrower, 'Borrower', {
    required: false,
    max: 80,
  });
  if (borrower) {
    const pattern = new RegExp(v.literal(borrower), 'i');
    filter.$or = [{ borrowerName: pattern }, { borrowerId: pattern }];
  }
  if (query.status) filter.status = v.choice(query.status, ['active', 'returned'], 'Loan status');
  if (query.equipmentId) filter.equipmentId = v.id(query.equipmentId);
  return Loan.find(filter).populate('equipmentId').sort({ borrowedAt: -1 }).lean();
}
module.exports = { borrowEquipment, returnEquipment, listLoans };
