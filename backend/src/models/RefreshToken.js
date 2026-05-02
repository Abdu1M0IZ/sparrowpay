// RefreshToken model - stores HMAC of refresh tokens with rotation chain info.
// Storing only the hash means a DB leak does not leak valid tokens.

const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    parentTokenHash: { type: String, default: null },
    revoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index - MongoDB auto-cleans expired entries (also serves as a regular index).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
