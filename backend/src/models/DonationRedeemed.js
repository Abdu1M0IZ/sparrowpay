// DonationRedeemed - one row per blind-signed token that has been spent.
//
// This collection is the heart of the anonymity property: it links a
// (one-time, randomly chosen) serialHash to the *recipient* of that token's
// 1-PKR credit, and crucially does NOT contain any reference to the donor.
// Because the donor blinded the serial before the bank ever saw it, the
// bank's (encrypted) mint audit and this redemption ledger cannot be
// correlated except by guessing serialHashes - which would require breaking
// SHA-256 preimage resistance.
//
// Other purposes:
//   - serialHash is unique, so the same token cannot be spent twice.
//   - amount is fixed at 1; the donation total is just the count of rows.

const mongoose = require('mongoose');

const donationRedeemedSchema = new mongoose.Schema(
  {
    serialHash: { type: String, required: true, unique: true, index: true },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0, default: 1 },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DonationRedeemed', donationRedeemedSchema);
