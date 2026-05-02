// Rate limiter using express-rate-limit. We expose two limiters:
//   apiLimiter  - generic per-IP cap for the whole /api router
//   authLimiter - tighter cap for auth endpoints (signup/login/reset)

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const standardOpts = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
};

const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  ...standardOpts,
  // Skip rate limiting in tests so test suites don't fight the limiter.
  skip: () => env.isTest,
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  ...standardOpts,
  skip: () => env.isTest,
});

module.exports = { apiLimiter, authLimiter };
