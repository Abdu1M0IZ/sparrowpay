// Me routes - mounted under /api/me. All require authentication.

const express = require('express');
const ctl = require('../controllers/meController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get('/', ctl.getMe);
router.patch('/profile', validate(schemas.updateProfileSchema), ctl.updateProfile);
router.patch('/password', validate(schemas.changePasswordSchema), ctl.changePassword);
// Legacy alias used by the old frontend (POST /me/change-pin) and the new clean PATCH route.
router.patch('/pin', validate(schemas.changePinSchema), ctl.changePin);
router.post('/change-pin', validate(schemas.changePinSchema), ctl.changePin);
router.post('/signing-key', ctl.registerSigningKey);

module.exports = router;
