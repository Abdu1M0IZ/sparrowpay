// Transaction routes - mounted under /api/transactions.

const express = require('express');
const ctl = require('../controllers/transactionController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get('/', ctl.listTransactions);
router.get('/:id', ctl.getTransaction);
router.post('/', validate(schemas.createTransactionSchema), ctl.createTransaction);

module.exports = router;
