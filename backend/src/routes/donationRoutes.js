// Donation routes - mounted under /api/donations.

const express = require('express');
const ctl = require('../controllers/donationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

router.get('/bank-key', ctl.bankKey);
router.post('/mint', requireAuth, validate(schemas.donationMintSchema), ctl.mint);
router.post('/redeem', validate(schemas.donationRedeemSchema), ctl.redeem);

module.exports = router;
