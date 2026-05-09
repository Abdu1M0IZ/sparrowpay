// Transaction controller.
//
// POST /api/transactions
//   - Verifies PIN, balance, recipient.
//   - For SparrowPay-to-SparrowPay (kind=transaction or donation), debits sender
//     and credits recipient, creating two Transaction docs (sender/receiver).
//   - For external banks (SadaPay/JazzCash), only debits sender and stores a
//     single Transaction document (no real interbank settlement).
//
// GET  /api/transactions?kind=transaction|donation
//   - Returns up to 100 most recent items for the authenticated user.
//
// GET  /api/transactions/:id
//   - Returns a single transaction belonging to the authenticated user.

const mongoose = require('mongoose');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} = require('../utils/errors');

// POST /api/transactions
async function createTransaction(req, res, next) {
  try {
    const user = req.user;
    const { kind, bankType, to, amount, pin } = req.body;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new BadRequestError('Amount must be greater than 0.');
    }

    const toLabel = String(to || '').trim();
    if (!toLabel) throw new BadRequestError('Recipient is required.');

    // SparrowPay donations now flow through /api/donations (blind-signature
    // mint+redeem). Refuse them here so the frontend is forced to use the
    // anonymizing path. External-bank donations stay on this endpoint
    // because there's no real recipient credit on the SparrowPay side, but
    // we anonymize the donor's stored label so the typed charity name
    // never lands in the database.
    if (kind === 'donation' && bankType === 'SparrowPay') {
      throw new BadRequestError(
        'Donations must use the /api/donations endpoints.'
      );
    }

    const pinOk = await User.verifySecret(pin, user.pinHash);
    if (!pinOk) throw new ForbiddenError('Invalid PIN.');

    const senderAcct = await Account.findOne({ user: user._id });
    if (!senderAcct) throw new BadRequestError('Sender account is missing.');
    if (senderAcct.balance < amt) throw new BadRequestError('Insufficient funds.');

    let createdSenderTx;

    if (bankType === 'SparrowPay') {
      // Internal transfer or donation - look up the recipient SparrowPay user.
      const recipient = await User.findOne({ username: toLabel });
      if (!recipient) {
        throw new NotFoundError('Recipient SparrowPay user not found.');
      }
      if (recipient._id.equals(user._id)) {
        throw new BadRequestError('Cannot transfer to your own account.');
      }
      const recipientAcct = await Account.findOne({ user: recipient._id });
      if (!recipientAcct) throw new BadRequestError('Recipient account is missing.');

      // Wrap the cross-document write in a Mongoose transaction so a crash
      // between debit and credit cannot leave the ledger inconsistent.
      // Requires MongoDB to run as a replica set (Atlas free tier qualifies;
      // the test suite uses MongoMemoryReplSet for the same reason).
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Atomic balance updates conditioned on sufficient funds. If the
          // sender's balance has changed since we read it (e.g., a concurrent
          // transfer), the conditional match will miss and we abort.
          const debit = await Account.findOneAndUpdate(
            { user: user._id, balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true, session }
          );
          if (!debit) throw new BadRequestError('Insufficient funds.');

          await Account.findOneAndUpdate(
            { user: recipient._id },
            { $inc: { balance: amt } },
            { new: true, session }
          );

          const [senderDoc] = await Transaction.create([{
            user: user._id,
            kind,
            bankType: 'SparrowPay',
            toLabel,
            amount: amt,
            status: 'Completed',
            meta: `SparrowPay • ${kind === 'donation' ? 'Donation' : 'Transfer'}`,
          }], { session });
          createdSenderTx = senderDoc;

          await Transaction.create([{
            user: recipient._id,
            kind,
            bankType: 'SparrowPay',
            toLabel: user.username,
            amount: amt,
            status: 'Received',
            meta: `SparrowPay • ${kind === 'donation' ? 'Donation Received' : 'Received'}`,
          }], { session });
        });
      } finally {
        session.endSession();
      }
    } else {
      // External bank: just debit and record. We still use a conditional
      // findOneAndUpdate so concurrent debits cannot drive the balance
      // negative, even though no recipient credit is involved.
      const debit = await Account.findOneAndUpdate(
        { user: user._id, balance: { $gte: amt } },
        { $inc: { balance: -amt } },
        { new: true }
      );
      if (!debit) throw new BadRequestError('Insufficient funds.');

      // For donations, scrub the typed charity name from the donor's record
      // so we don't unnecessarily retain potentially sensitive recipient
      // identity data. Transfers keep the recipient label as-is because
      // the user needs to see it in their own history.
      const isDonation = kind === 'donation';
      createdSenderTx = await Transaction.create({
        user: user._id,
        kind,
        bankType,
        toLabel: isDonation ? 'Anonymous Donation' : toLabel,
        amount: amt,
        status: 'Completed',
        meta: `${bankType} • ${isDonation ? 'Anonymous Donation' : 'Bank Transfer'}`,
      });
    }

    const out = createdSenderTx.toPublic();
    return res.status(201).json({ success: true, ...out, data: out });
  } catch (err) {
    return next(err);
  }
}

// GET /api/transactions?kind=transaction|donation
async function listTransactions(req, res, next) {
  try {
    const kindRaw = String(req.query.kind || '').toLowerCase();
    const kind = ['transaction', 'donation'].includes(kindRaw) ? kindRaw : null;
    const filter = { user: req.user._id };
    if (kind) filter.kind = kind;
    const docs = await Transaction.find(filter).sort({ createdAt: -1 }).limit(100);
    const items = docs.map((t) => t.toPublic());
    return res.json({ success: true, items, data: { items } });
  } catch (err) {
    return next(err);
  }
}

// GET /api/transactions/:id
async function getTransaction(req, res, next) {
  try {
    const id = req.params.id;
    const doc = await Transaction.findOne({ _id: id, user: req.user._id });
    if (!doc) throw new NotFoundError('Transaction not found.');
    const out = doc.toPublic();
    return res.json({ success: true, ...out, data: out });
  } catch (err) {
    // Bad ObjectId => 404 instead of 500.
    if (err && err.name === 'CastError') {
      return next(new NotFoundError('Transaction not found.'));
    }
    return next(err);
  }
}

module.exports = { createTransaction, listTransactions, getTransaction };
