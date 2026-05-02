// Donation model - simplified donation record.
//
// Note: the original Python backend used a blind-signature donation flow
// (mint/redeem) for unlinkable donations. For the MERN refactor we keep a
// simplified, fully dynamic donation flow that:
//   - mints "tokens" as opaque random strings deducted from the user's wallet
//   - redeems tokens against a recipient label
// This is sufficient to demonstrate dynamic database-backed donations and
// preserves the front-end donation experience without requiring RSA blind
// signing. See the project report for the trade-off rationale.

const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    serialHash: { type: String, required: true, unique: true, index: true },
    issuedToUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    redeemed: { type: Boolean, default: false },
    redeemedAt: { type: Date, default: null },
    recipientLabel: { type: String, default: '', maxlength: 128 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Donation', donationSchema);
