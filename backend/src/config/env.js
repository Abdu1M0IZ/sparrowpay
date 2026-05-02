// Centralized, validated environment variables.
// Loaded once at startup. Throws clear errors if required vars are missing.

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the backend root (one level above /src)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const v = process.env[name];
  if (v && String(v).trim() !== '') return v;
  if (fallback !== undefined) return fallback;
  // In tests we don't error - tests provide their own setup.
  if (isTest) return '';
  throw new Error(`Missing required environment variable: ${name}`);
}

function num(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num('PORT', 5000),
  isProd: process.env.NODE_ENV === 'production',
  isTest,

  mongoUri: isTest
    ? (process.env.MONGO_URI || '')
    : required('MONGO_URI'),

  jwt: {
    accessSecret: isTest
      ? (process.env.JWT_SECRET || 'test_access_secret_at_least_32_chars_xxxxxxxxxx')
      : required('JWT_SECRET'),
    refreshSecret: isTest
      ? (process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_chars_xxxxxxxxx')
      : required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  masterEncKeyB64: process.env.MASTER_ENC_KEY || '',

  initialBalance: num('INITIAL_BALANCE', 20000),

  rateLimit: {
    windowMs: num('RATE_LIMIT_WINDOW_MS', 60_000),
    max: num('RATE_LIMIT_MAX', 120),
  },
};

// Sanity checks (skipped in test).
if (!isTest) {
  if (config.jwt.accessSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  if (config.jwt.refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long.');
  }
}

module.exports = config;
