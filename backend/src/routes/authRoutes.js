// Auth routes - mounted under /api/auth.

const express = require('express');
const ctl = require('../controllers/authController');
const { validate, schemas } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/signup', authLimiter, validate(schemas.signupSchema), ctl.signup);
router.post('/login', authLimiter, validate(schemas.loginSchema), ctl.login);
router.post('/refresh', ctl.refresh); // body validation done inside controller for compat
router.post('/logout', ctl.logout);
router.get('/check-username', validate(schemas.checkUsernameSchema, 'query'), ctl.checkUsername);
router.post(
  '/reset-password-by-pin',
  authLimiter,
  validate(schemas.resetPasswordByPinSchema),
  ctl.resetPasswordByPin
);
router.post('/forgot-pin', authLimiter, validate(schemas.forgotPinSchema), ctl.forgotPin);

module.exports = router;
