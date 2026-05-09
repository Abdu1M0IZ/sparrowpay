// Donation controller - RSA blind-signature flow.
//
// The donor's mint and the recipient's redeem are unlinkable in the database:
//   - mint sees blinded serials only (the donor multiplies the SHA-256 hash
//     by r^e for a random per-token blinder r before sending). No serial,
//     no signature, ever touches the donor's request payload in plaintext.
//   - redeem sees the unblinded (serial, sig) pairs but has no reference to
//     who minted them. The recipient is named explicitly because the credit
//     has to land somewhere, but the donor identity is already gone.
//
// Per spec, denomination is fixed at 1 PKR per token. count === amount is
// enforced server-side, eliminating inflation attacks. Mints over 200 PKR
// must be chunked client-side.

const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Account = require('../models/Account');
const DonationRedeemed = require('../models/DonationRedeemed');
const DonationMintAudit = require('../models/DonationMintAudit');
const Transaction = require('../models/Transaction');

const bankRsa = require('../config/bankRsa');
const ac = require('../utils/anonymousCrypto');
const { encryptField } = require('../utils/crypto');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/errors');

const MAX_COUNT_PER_MINT = 200;

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// GET /api/donations/bank-key - public, returns the RSA public params.
async function bankKey(_req, res) {
  return res.json({
    success: true,
    n_b64url: bankRsa.nB64url,
    e: bankRsa.eNumber,
    algorithm: 'RSA-2048-blind-SHA256',
    issuer: 'sparrowpay',
    maxCountPerMint: MAX_COUNT_PER_MINT,
    denomination: 1,
  });
}

// POST /api/donations/mint - authenticated. Debits the donor and signs the
// blinded serials. Returns one signature per blinded value. The serials and
// the unblinded signatures stay client-side; the bank never learns them.
async function mint(req, res, next) {
  try {
    const user = req.user;
    const { blindedSerials, amount, pin } = req.body;

    // Schema has already validated array shape and ranges; reaffirm the
    // count-amount invariant here because it's a domain rule, not a syntax rule.
    const count = blindedSerials.length;
    if (count !== amount) {
      throw new BadRequestError('count must equal amount (denomination is 1 PKR per token).');
    }
    if (count < 1 || count > MAX_COUNT_PER_MINT) {
      throw new BadRequestError(`count must be 1..${MAX_COUNT_PER_MINT}.`);
    }

    const pinOk = await User.verifySecret(pin, user.pinHash);
    if (!pinOk) throw new ForbiddenError('Invalid PIN.');

    // Parse all blinded inputs up front. Reject early if any are malformed
    // or out of [0, n) range, before we touch the database.
    const blindedBigInts = [];
    for (const s of blindedSerials) {
      let b;
      try {
        b = ac.b64urlToBigInt(s);
      } catch {
        throw new BadRequestError('Malformed blinded serial.');
      }
      if (b < 0n || b >= bankRsa.n) {
        throw new BadRequestError('Blinded value out of range.');
      }
      blindedBigInts.push(b);
    }

    // Sign all blinded values. We do this BEFORE the DB session below so
    // any signing failure aborts cleanly without holding a Mongo transaction
    // open. signBlinded is OpenSSL-backed and ~1ms per call.
    const signedBigInts = blindedBigInts.map((b) => bankRsa.signBlinded(b));

    // Now persist the audit, debit, and the donor-facing transaction in a
    // single Mongo transaction so the ledger can never be partially updated.
    let createdSenderTx = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const debit = await Account.findOneAndUpdate(
          { user: user._id, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { new: true, session }
        );
        if (!debit) throw new BadRequestError('Insufficient funds.');

        const metadataEnc = encryptField(JSON.stringify({
          donorId: user._id.toString(),
          amount,
          count,
          ts: new Date().toISOString(),
        }));

        await DonationMintAudit.create([{
          donor: user._id,
          amount,
          count,
          metadataEnc,
        }], { session });

        const [txDoc] = await Transaction.create([{
          user: user._id,
          kind: 'donation',
          bankType: 'SparrowPay',
          toLabel: 'Anonymous Donation',
          amount,
          status: 'Completed',
          meta: 'SparrowPay • Anonymous Donation',
        }], { session });
        createdSenderTx = txDoc;
      });
    } finally {
      session.endSession();
    }

    return res.json({
      success: true,
      signatures: signedBigInts.map((s) => ac.bigIntToB64url(s, bankRsa.modulusByteLen)),
      n_b64url: bankRsa.nB64url,
      e: bankRsa.eNumber,
      donorTransaction: createdSenderTx ? createdSenderTx.toPublic() : null,
    });
  } catch (err) {
    return next(err);
  }
}

// POST /api/donations/redeem - bearer-token model, no auth header.
//
// Anyone holding (serial, sig) pairs can redeem them. Each token can only be
// redeemed once (enforced by serialHash unique index). Recipient must be a
// SparrowPay user (by username); the credit lands in their account.
async function redeem(req, res, next) {
  try {
    const { tokens, recipient: recipientName } = req.body;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new BadRequestError('tokens must be a non-empty array.');
    }
    if (tokens.length > MAX_COUNT_PER_MINT) {
      throw new BadRequestError(`tokens length must be 1..${MAX_COUNT_PER_MINT}.`);
    }

    const recipient = await User.findOne({ username: recipientName });
    if (!recipient) throw new NotFoundError('Recipient SparrowPay user not found.');

    // First pass: cryptographic verification. Any token failing this is
    // rejected silently (we just don't credit it). Tokens that verify are
    // collected for the second pass which checks for double-spend.
    const verified = []; // { serialHex, serialHash, sigBigInt }
    for (const t of tokens) {
      if (!t || typeof t !== 'object') continue;
      const { serial: serialHex, sig: sigB64url } = t;
      if (typeof serialHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(serialHex)) continue;
      if (typeof sigB64url !== 'string' || !sigB64url) continue;

      let sig;
      try {
        sig = ac.b64urlToBigInt(sigB64url);
      } catch {
        continue;
      }
      if (sig < 0n || sig >= bankRsa.n) continue;

      const serialBytes = Buffer.from(serialHex, 'hex');
      if (!ac.verifyToken(serialBytes, sig, bankRsa.e, bankRsa.n)) continue;

      verified.push({
        serialHex,
        serialHash: sha256Hex(serialHex),
        sigBigInt: sig,
      });
    }

    if (verified.length === 0) {
      throw new BadRequestError('No valid tokens redeemed.');
    }

    // Second pass: try to insert each verified token's serialHash into
    // DonationRedeemed. The unique index on serialHash atomically rejects
    // double-spends. We do the inserts inside a Mongo transaction together
    // with the recipient's balance increment and the recipient-facing
    // transaction record.
    let creditedAmount = 0;
    let redeemedCount = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const inserts = [];
        for (const v of verified) {
          // Pre-check by querying first; we still rely on the unique index
          // for the actual race-safety guarantee, but a query here lets us
          // surface "already spent" without burning insert errors in the
          // common case.
          // eslint-disable-next-line no-await-in-loop
          const exists = await DonationRedeemed.findOne(
            { serialHash: v.serialHash },
            { _id: 1 },
            { session }
          );
          if (exists) continue;
          inserts.push({
            serialHash: v.serialHash,
            recipient: recipient._id,
            amount: 1,
            redeemedAt: new Date(),
          });
        }

        // ordered:false so a single duplicate-key error (raced double-spend)
        // doesn't abort the entire batch.
        if (inserts.length > 0) {
          try {
            const written = await DonationRedeemed.insertMany(inserts, {
              session,
              ordered: false,
            });
            redeemedCount = written.length;
          } catch (e) {
            // BulkWriteError still returns a partial result on insertedDocs
            // for ordered:false. Mongoose surfaces it as e.insertedDocs.
            if (e && Array.isArray(e.insertedDocs)) {
              redeemedCount = e.insertedDocs.length;
            } else {
              throw e;
            }
          }
        }

        if (redeemedCount === 0) {
          // All tokens were already spent. Roll back by throwing - the
          // session.withTransaction wrapper will abort.
          throw new BadRequestError('No valid tokens redeemed.');
        }

        creditedAmount = redeemedCount; // 1 PKR per token

        await Account.findOneAndUpdate(
          { user: recipient._id },
          { $inc: { balance: creditedAmount } },
          { new: true, session }
        );

        await Transaction.create([{
          user: recipient._id,
          kind: 'donation',
          bankType: 'SparrowPay',
          toLabel: 'Anonymous Donor',
          amount: creditedAmount,
          status: 'Received',
          meta: 'SparrowPay • Anonymous Donation Received',
        }], { session });
      });
    } finally {
      session.endSession();
    }

    return res.json({
      success: true,
      redeemedCount,
      redeemed_count: redeemedCount,    // legacy alias
      creditedAmount,
      credited_amount: creditedAmount,  // legacy alias
      status: 'ok',
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  bankKey,
  mint,
  redeem,
  MAX_COUNT_PER_MINT,
};
