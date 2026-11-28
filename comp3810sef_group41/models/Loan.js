/**
 * Loan record connecting one equipment document to one borrower.
 * Many returned loans may reference the same asset, but the partial unique
 * index allows only one active loan per asset at a time.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const loanSchema = new Schema(
  {
    equipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Equipment',
      required: true,
    },
    borrowerName: { type: String, required: true, maxlength: 80 },
    borrowerId: { type: String, required: true, maxlength: 40 },
    borrowedAt: { type: Date, required: true, default: Date.now },
    dueAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'returned'],
      default: 'active',
      required: true,
    },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);
// One active loan per asset; returned history is unrestricted.
loanSchema.index(
  { equipmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_loan_per_equipment',
  },
);
// Supports borrower + status searches on the loans page.
loanSchema.index({ borrowerId: 1, status: 1 });

module.exports = mongoose.model('Loan', loanSchema);
