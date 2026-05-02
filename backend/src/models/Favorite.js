// Favorite model - saved beneficiaries scoped to a user.

const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    accountType: {
      type: String,
      enum: ['SparrowPay', 'SadaPay', 'JazzCash'],
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index: same user cannot have duplicate (name, accountType).
favoriteSchema.index({ user: 1, name: 1, accountType: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

favoriteSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    accountType: this.accountType,
    account_type: this.accountType,  // legacy alias
    created_at: this.createdAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Favorite', favoriteSchema);
