// Authentication middleware - verifies Bearer access tokens.

const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../utils/errors');
const User = require('../models/User');

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization || '';
    if (!header.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or malformed Authorization header.'));
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) return next(new UnauthorizedError('Missing access token.'));

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(new UnauthorizedError('Invalid or expired token.'));
    }

    if (payload.type !== 'access') {
      return next(new UnauthorizedError('Wrong token type.'));
    }

    const user = await User.findById(payload.sub);
    if (!user) return next(new UnauthorizedError('User not found.'));

    req.user = user;
    req.userId = user._id;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
