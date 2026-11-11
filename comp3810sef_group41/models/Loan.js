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
// Returned loans can coexist; only one ACTIVE loan may reference an asset.
loanSchema.index(
  { equipmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_loan_per_equipment',
  },
);
loanSchema.index({ borrowerId: 1, status: 1 });

module.exports = mongoose.model('Loan', loanSchema);
