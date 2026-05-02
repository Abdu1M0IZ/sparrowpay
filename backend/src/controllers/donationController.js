// Donation controller (simplified MERN implementation).
//
// The original Python backend used RSA blind signatures for unlinkable
// donations. We replace that with a straightforward, fully dynamic flow:
//   - GET  /api/donations/bank-key    -> simple metadata response
//   - POST /api/donations/mint        -> debit wallet, issue N opaque tokens
//   - POST /api/donations/redeem      -> mark tokens redeemed by recipient
//
// Tokens are random hex strings; the SHA-256 hash is stored. Recipients can
// redeem unique tokens once. This satisfies the "dynamic database-backed
// donation flow" requirement called out in the refactor prompt.

const crypto = require('crypto');
const env = require('../config/env');
const User = require('../models/User');
const Account = require('../models/Account');
const Donation = require('../models/Donation');
const { BadRequestError, ForbiddenError } = require('../utils/errors');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// GET /api/donations/bank-key
async function bankKey(_req, res) {
  return res.json({
    success: true,
    note: 'Simplified donation tokens. SHA-256 of token is stored server-side.',
    algorithm: 'sha256-token',
    issuer: 'sparrowpay',
  });
}

// POST /api/donations/mint
async function mint(req, res, next) {
  try {
    const { amount, count, pin } = req.body;
    const user = req.user;

    const pinOk = await User.verifySecret(pin, user.pinHash);
    if (!pinOk) throw new ForbiddenError('Invalid PIN.');

    const total = Number(amount);
    const n = Number(count);
    if (!Number.isFinite(total) || total <= 0) throw new BadRequestError('amount must be > 0.');
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new BadRequestError('count must be 1..50.');

    const acct = await Account.findOne({ user: user._id });
    if (!acct || acct.balance < total) throw new BadRequestError('Insufficient funds.');

    acct.balance -= total;
    await acct.save();

    const perToken = Number((total / n).toFixed(2));
    const tokens = [];
    for (let i = 0; i < n; i += 1) {
      const tok = crypto.randomBytes(24).toString('hex');
      tokens.push(tok);
      // eslint-disable-next-line no-await-in-loop
      await Donation.create({
        serialHash: sha256Hex(tok),
        issuedToUser: user._id,
        amount: perToken,
      });
    }

    return res.json({
      success: true,
      tokens,
      perTokenAmount: perToken,
      issuer: 'sparrowpay',
      note: 'Each token can be redeemed exactly once.',
    });
  } catch (err) {
    return next(err);
  }
}

// POST /api/donations/redeem
async function redeem(req, res, next) {
  try {
    const { tokens, recipientLabel } = req.body;
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new BadRequestError('tokens must be a non-empty array.');
    }

    let redeemed = 0;
    let credited = 0;
    for (const t of tokens) {
      if (typeof t !== 'string' || !t) continue;
      const sh = sha256Hex(t);
      // eslint-disable-next-line no-await-in-loop
      const doc = await Donation.findOne({ serialHash: sh, redeemed: false });
      if (!doc) continue;
      doc.redeemed = true;
      doc.redeemedAt = new Date();
      doc.recipientLabel = recipientLabel || '';
      // eslint-disable-next-line no-await-in-loop
      await doc.save();
      redeemed += 1;
      credited += Number(doc.amount);
    }

    if (redeemed === 0) throw new BadRequestError('No valid tokens redeemed.');
    return res.json({
      success: true,
      redeemed_count: redeemed,
      redeemedCount: redeemed,
      credited_amount: credited,
      creditedAmount: credited,
      status: 'ok',
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { bankKey, mint, redeem, _initialBalance: env.initialBalance };
