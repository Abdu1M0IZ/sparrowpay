// Auth controller - signup, login, refresh, logout, username check,
// reset password by PIN, forgot PIN by password.

const env = require('../config/env');
const User = require('../models/User');
const Account = require('../models/Account');
const RefreshToken = require('../models/RefreshToken');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
} = require('../utils/jwt');
const { encryptField } = require('../utils/crypto');
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require('../utils/errors');

// Refresh tokens default to 7 days; we mirror the value here for DB expiry.
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function issueTokens(userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await RefreshToken.create({
    user: userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken };
}

function authResponse(user, tokens) {
  return {
    success: true,
    // Snake-case fields preserved for backward compatibility with the original frontend.
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    token_type: 'bearer',
    user: { id: user._id.toString(), username: user.username, full_name: user.fullName || '', fullName: user.fullName || '' },
  };
}

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const { fullName, username, password, phone, cnic, pin } = req.body;
    const exists = await User.findOne({ username });
    if (exists) throw new ConflictError('Username already exists.');

    const passwordHash = await User.hashSecret(password);
    const pinHash = await User.hashSecret(pin);

    const user = await User.create({
      username,
      fullName: fullName || '',
      passwordHash,
      pinHash,
      phoneEnc: encryptField(phone),
      cnicEnc: encryptField(cnic),
    });

    await Account.create({ user: user._id, balance: env.initialBalance });

    const tokens = await issueTokens(user._id);
    return res.status(201).json(authResponse(user, tokens));
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) throw new UnauthorizedError('Invalid credentials.');
    const ok = await User.verifySecret(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid credentials.');

    const tokens = await issueTokens(user._id);
    return res.json(authResponse(user, tokens));
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/refresh
// Accepts either { refreshToken } or { refresh_token } for compatibility.
async function refresh(req, res, next) {
  try {
    const incoming = req.body.refreshToken || req.body.refresh_token;
    if (!incoming) throw new BadRequestError('refreshToken is required.');

    let payload;
    try {
      payload = verifyRefreshToken(incoming);
    } catch {
      throw new UnauthorizedError('Invalid refresh token.');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedError('Wrong token type.');

    const tokenHash = hashRefreshToken(incoming);
    const stored = await RefreshToken.findOne({ tokenHash });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    // Rotate: revoke old, issue new.
    stored.revoked = true;
    await stored.save();

    const user = await User.findById(payload.sub);
    if (!user) throw new UnauthorizedError('User not found.');

    const newTokens = await issueTokens(user._id);
    // Link the new token back to its parent for audit/rotation chain.
    await RefreshToken.updateOne(
      { tokenHash: hashRefreshToken(newTokens.refreshToken) },
      { $set: { parentTokenHash: tokenHash } }
    );
    return res.json(authResponse(user, newTokens));
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const incoming = req.body.refreshToken || req.body.refresh_token;
    if (!incoming) return res.json({ success: true, status: 'ok' });
    const tokenHash = hashRefreshToken(incoming);
    await RefreshToken.updateOne({ tokenHash }, { $set: { revoked: true } });
    return res.json({ success: true, status: 'ok' });
  } catch (err) {
    return next(err);
  }
}

// GET /api/auth/check-username?username=foo
async function checkUsername(req, res, next) {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) throw new BadRequestError('username is required.');
    const taken = !!(await User.findOne({ username }));
    return res.json({ success: true, available: !taken, taken });
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/reset-password-by-pin
async function resetPasswordByPin(req, res, next) {
  try {
    const { username, pin, newPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) throw new NotFoundError('User not found.');
    const pinOk = await User.verifySecret(pin, user.pinHash);
    if (!pinOk) throw new UnauthorizedError('Invalid PIN.');
    user.passwordHash = await User.hashSecret(newPassword);
    await user.save();
    // Revoke all refresh tokens after password change.
    await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } });
    return res.json({ success: true, status: 'ok' });
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/forgot-pin
async function forgotPin(req, res, next) {
  try {
    const { username, password, newPin } = req.body;
    const user = await User.findOne({ username });
    if (!user) throw new NotFoundError('User not found.');
    const pwdOk = await User.verifySecret(password, user.passwordHash);
    if (!pwdOk) throw new UnauthorizedError('Invalid password.');
    user.pinHash = await User.hashSecret(newPin);
    await user.save();
    // Revoke all refresh tokens. The PIN gates transaction creation and the
    // forgot-PIN flow could be used by an attacker who knows the password to
    // hijack PIN-protected actions; killing existing sessions keeps the
    // semantics consistent with reset-password-by-pin.
    await RefreshToken.updateMany({ user: user._id, revoked: false }, { $set: { revoked: true } });
    return res.json({ success: true, status: 'ok' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
  checkUsername,
  resetPasswordByPin,
  forgotPin,
};
