// Me controller - returns and updates the authenticated user's profile.

const User = require('../models/User');
const Account = require('../models/Account');
const RefreshToken = require('../models/RefreshToken');
const { encryptField, decryptField } = require('../utils/crypto');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

// GET /api/me
async function getMe(req, res, next) {
  try {
    const user = req.user;
    const acct = await Account.findOne({ user: user._id });
    return res.json({
      success: true,
      data: {
        id: user._id.toString(),
        username: user.username,
        full_name: user.fullName || '',
        fullName: user.fullName || '',
        phone: decryptField(user.phoneEnc),
        cnic: decryptField(user.cnicEnc),
        balance: Number(acct ? acct.balance : 0),
        request_signing_enabled: false,
      },
      // Keep top-level fields too so the existing frontend code (which reads
      // me.balance / me.username directly off the response) keeps working.
      id: user._id.toString(),
      username: user.username,
      full_name: user.fullName || '',
      fullName: user.fullName || '',
      phone: decryptField(user.phoneEnc),
      cnic: decryptField(user.cnicEnc),
      balance: Number(acct ? acct.balance : 0),
    });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/me/profile  - update fullName / phone
async function updateProfile(req, res, next) {
  try {
    const { fullName, phone } = req.body;
    const user = req.user;
    if (typeof fullName === 'string') user.fullName = fullName;
    if (typeof phone === 'string' && phone.length) user.phoneEnc = encryptField(phone);
    await user.save();
    return res.json({
      success: true,
      data: {
        id: user._id.toString(),
        username: user.username,
        full_name: user.fullName || '',
        fullName: user.fullName || '',
        phone: decryptField(user.phoneEnc),
        cnic: decryptField(user.cnicEnc),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/me/password
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    const ok = await User.verifySecret(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Current password is incorrect.');
    if (currentPassword === newPassword) {
      throw new BadRequestError('New password must be different from current password.');
    }
    user.passwordHash = await User.hashSecret(newPassword);
    await user.save();
    // Revoke existing refresh tokens for safety.
    await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } });
    return res.json({ success: true, status: 'ok', message: 'Password updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/me/pin
async function changePin(req, res, next) {
  try {
    const { currentPin, newPin } = req.body;
    const user = req.user;
    const ok = await User.verifySecret(currentPin, user.pinHash);
    if (!ok) throw new UnauthorizedError('Current PIN is incorrect.');
    user.pinHash = await User.hashSecret(newPin);
    await user.save();
    return res.json({ success: true, status: 'ok', message: 'PIN updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

// POST /api/me/signing-key  - kept as a no-op stub for forward compatibility.
async function registerSigningKey(_req, res) {
  return res.json({ success: true, status: 'ok', request_signing_enabled: false });
}

module.exports = {
  getMe,
  updateProfile,
  changePassword,
  changePin,
  registerSigningKey,
};
