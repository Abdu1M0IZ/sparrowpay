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

      senderAcct.balance -= amt;
      recipientAcct.balance += amt;
      await senderAcct.save();
      await recipientAcct.save();

      createdSenderTx = await Transaction.create({
        user: user._id,
        kind,
        bankType: 'SparrowPay',
        toLabel,
        amount: amt,
        status: 'Completed',
        meta: `SparrowPay • ${kind === 'donation' ? 'Donation' : 'Transfer'}`,
      });

      await Transaction.create({
        user: recipient._id,
        kind,
        bankType: 'SparrowPay',
        toLabel: user.username,
        amount: amt,
        status: 'Received',
        meta: `SparrowPay • ${kind === 'donation' ? 'Donation Received' : 'Received'}`,
      });
    } else {
      // External bank: just debit and record.
      senderAcct.balance -= amt;
      await senderAcct.save();

      createdSenderTx = await Transaction.create({
        user: user._id,
        kind,
        bankType,
        toLabel,
        amount: amt,
        status: 'Completed',
        meta: `${bankType} • ${kind === 'donation' ? 'Donation' : 'Bank Transfer'}`,
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
