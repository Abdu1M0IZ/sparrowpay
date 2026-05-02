// Transaction model - records both transactions and donations, sent and received.

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: { type: String, enum: ['transaction', 'donation'], required: true, index: true },
    bankType: { type: String, enum: ['SparrowPay', 'SadaPay', 'JazzCash'], required: true },
    toLabel: { type: String, required: true, trim: true, maxlength: 128 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['Completed', 'Received', 'Failed', 'Pending'],
      default: 'Completed',
    },
    meta: { type: String, maxlength: 256, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, kind: 1, createdAt: -1 });

transactionSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    kind: this.kind,
    bankType: this.bankType,
    bank_type: this.bankType,                 // legacy alias
    to: this.toLabel,
    amount: Number(this.amount),
    status: this.status,
    meta: this.meta || '',
    created_at: this.createdAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Transaction', transactionSchema);
