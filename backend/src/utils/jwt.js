// JWT helpers for access and refresh tokens.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(userId) {
  return jwt.sign(
    { sub: String(userId), type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn, issuer: 'sparrowpay' }
  );
}

function signRefreshToken(userId) {
  // Add a random jti so two tokens issued in the same second are distinct.
  return jwt.sign(
    { sub: String(userId), type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn, issuer: 'sparrowpay' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: 'sparrowpay' });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret, { issuer: 'sparrowpay' });
}

// Hash a refresh token before storing it so that DB compromise doesn't leak tokens.
function hashRefreshToken(token) {
  return crypto.createHmac('sha256', env.jwt.refreshSecret).update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
};
