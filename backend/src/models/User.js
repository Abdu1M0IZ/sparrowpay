// User model - authentication identity, hashed credentials, encrypted PII.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
      index: true,
    },
    fullName: { type: String, trim: true, maxlength: 128, default: '' },
    passwordHash: { type: String, required: true },
    pinHash: { type: String, required: true },

    // Sensitive fields - stored encrypted (or plaintext if no key configured).
    phoneEnc: { type: String, required: true },
    cnicEnc: { type: String, required: true },
  },
  { timestamps: true }
);

// Bcrypt helpers wrapped on the model so callers don't need to import bcrypt.
userSchema.statics.hashSecret = async function hashSecret(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plain), salt);
};

userSchema.statics.verifySecret = async function verifySecret(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), String(hash));
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    fullName: this.fullName || '',
  };
};

module.exports = mongoose.model('User', userSchema);
