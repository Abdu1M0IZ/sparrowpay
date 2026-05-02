// Account model - one wallet per user, tracks PKR balance.

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
