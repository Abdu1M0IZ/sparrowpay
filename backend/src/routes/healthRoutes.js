// Health routes - mounted under /api/health.

const express = require('express');
const ctl = require('../controllers/healthController');

const router = express.Router();

router.get('/', ctl.health);

module.exports = router;
