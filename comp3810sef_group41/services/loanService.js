/**
 * Loan service.
 *
 * A loan has no generic create/update path: borrowing and returning are
 * explicit operations that mutate the linked equipment status in the same
 * transaction as the loan document. Listing supports borrower/status/asset
 * filters and populates the referenced equipment.
 */

const mongoose = require('mongoose');
const AbstractService = require('./AbstractService');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');
const v = require('../helpers');
const { fail } = require('../helpers');

class LoanService extends AbstractService {
  constructor() {
    super(Loan, { name: 'Loan', defaultSort: { borrowedAt: -1 } });
  }

  /**
   * Loans are addressed by their database ID only.
   * @param {string} value Loan database ID.
   * @returns {Record<string, unknown>} MongoDB filter.
   */
  buildFilter(value) {
    return { _id: v.id(value) };
  }

  /** @inheritdoc */
  buildQuery(query = {}) {
    v.filters(query, ['borrower', 'status', 'equipmentId']);
    const filter = {};
    const borrower = v.text(query.borrower, 'Borrower', { required: false, max: 80 });
    if (borrower) {
      const pattern = new RegExp(v.literal(borrower), 'i');
      filter.$or = [{ borrowerName: pattern }, { borrowerId: pattern }];
    }
    if (query.status) filter.status = v.choice(query.status, ['active', 'returned'], 'Loan status');
    if (query.equipmentId) filter.equipmentId = v.id(query.equipmentId);
    return Loan.find(filter).populate('equipmentId').sort(this.defaultSort);
  }

  /**
   * Validates a checkout request.
   * @param {Record<string, unknown>} data Raw request body.
   * @returns {Record<string, unknown>} Sanitised loan fields.
   */
  validateLoan(data) {
    v.allowed(data, ['equipmentId', 'borrowerName', 'borrowerId', 'dueAt', 'notes']);
    const fields = {
      equipmentId: v.id(data.equipmentId),
      borrowerName: v.text(data.borrowerName, 'Borrower name', { max: 80 }),
      borrowerId: v.text(data.borrowerId, 'Borrower ID', { max: 40 }),
      notes: v.text(data.notes, 'Notes', { required: false, max: 1000 }),
    };
    if (data.dueAt) {
      const raw = v.text(data.dueAt, 'Expected return time', { max: 40 });
      if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
        fail(
          400,
          'INVALID_DATE',
          'Date must include a timezone, for example 2026-11-20T18:00:00+08:00.',
        );
      }
      fields.dueAt = new Date(raw);
      if (isNaN(fields.dueAt) || fields.dueAt <= new Date()) {
        fail(400, 'INVALID_DATE', 'Expected return time must be in the future.');
      }
    }
    return fields;
  }

  /**
   * Checks out an available asset and creates the active loan atomically.
   * @param {Record<string, unknown>} data Raw request body.
   * @param {unknown} [handledBy] Administrator ID when authenticated.
   * @returns {Promise<Record<string, unknown>>} Created loan document.
   */
  async borrow(data, handledBy = null) {
    const fields = { ...this.validateLoan(data), handledBy };
    let result;
    await mongoose.connection.transaction(async (session) => {
      const item = await Equipment.findOneAndUpdate(
        { _id: fields.equipmentId, status: 'available' },
        { $set: { status: 'borrowed' } },
        { new: true, session },
      );
      if (!item) {
        if (!(await Equipment.exists({ _id: fields.equipmentId }).session(session))) {
          fail(404, 'NOT_FOUND', 'Equipment not found.');
        }
        fail(
          409,
          'NOT_AVAILABLE',
          'Equipment is borrowed or under maintenance and cannot be checked out.',
        );
      }
      [result] = await Loan.create([fields], { session });
    });
    return result;
  }

  /**
   * Returns an active loan and frees its equipment atomically.
   * @param {string} value Loan database ID.
   * @returns {Promise<Record<string, unknown>>} Updated loan document.
   */
  async returnLoan(value) {
    v.id(value);
    let result;
    await mongoose.connection.transaction(async (session) => {
      result = await Loan.findOneAndUpdate(
        { _id: value, status: 'active' },
        { $set: { status: 'returned', returnedAt: new Date() } },
        { new: true, session },
      );
      if (!result) {
        if (!(await Loan.exists({ _id: value }).session(session))) {
          fail(404, 'NOT_FOUND', 'Loan not found.');
        }
        fail(409, 'ALREADY_RETURNED', 'This loan has already been returned.');
      }
      const item = await Equipment.findOneAndUpdate(
        { _id: result.equipmentId, status: 'borrowed' },
        { $set: { status: 'available' } },
        { new: true, session },
      );
      if (!item) {
        fail(
          409,
          'INCONSISTENT_STATE',
          'Equipment and loan states do not match. This return was rolled back.',
        );
      }
    });
    return result;
  }
}

module.exports = new LoanService();
