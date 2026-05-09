// DonationMintAudit - one row per mint() call.
//
// Records that a particular user spent N PKR to mint N donation tokens, for
// billing/compliance/anti-fraud purposes. Crucially, it does NOT store the
// blinded values, the serials, or any data that would let the operator link
// the mint to the corresponding redemption rows in DonationRedeemed.
//
//   donor       - plaintext for audit (necessary for billing)
//   amount      - PKR debited (== count, since denomination = 1 PKR)
//   count       - number of tokens minted in this call
//   metadataEnc - AES-GCM ciphertext (via utils/crypto.encryptField), opaque
//                 string of the form "v1:<iv>:<ct>:<tag>". Holds whatever
//                 free-form metadata we want to preserve for forensics
//                 (e.g. JSON-encoded donor IP, user agent, timestamp) but
//                 is unreadable without MASTER_ENC_KEY.

const mongoose = require('mongoose');

const donationMintAuditSchema = new mongoose.Schema(
  {
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    count: { type: Number, required: true, min: 1 },
    metadataEnc: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DonationMintAudit', donationMintAuditSchema);
