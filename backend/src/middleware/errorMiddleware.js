// Centralized error handler. Translates known errors and unknown errors to
// the consistent { success: false, message } JSON shape.

const { AppError } = require('../utils/errors');

// 404 fallback for unmatched routes.
function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Mongoose duplicate key.
  if (err && err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {}).join(', ') || 'field';
    message = `Duplicate value for ${field}.`;
  }

  // Mongoose validation.
  if (err && err.name === 'ValidationError') {
    status = 400;
    const parts = Object.values(err.errors || {}).map((e) => e.message);
    if (parts.length) message = parts.join(' ');
  }

  // JWT.
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    status = 401;
    message = 'Invalid or expired token.';
  }

  // Hide stack traces from clients in production.
  const payload = { success: false, message, detail: message };
  if (process.env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
