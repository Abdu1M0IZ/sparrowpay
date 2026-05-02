// Custom error classes used to translate domain errors into HTTP status codes.

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class BadRequestError extends AppError {
  constructor(msg = 'Bad request') { super(msg, 400); }
}

class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') { super(msg, 401); }
}

class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') { super(msg, 403); }
}

class NotFoundError extends AppError {
  constructor(msg = 'Not found') { super(msg, 404); }
}

class ConflictError extends AppError {
  constructor(msg = 'Conflict') { super(msg, 409); }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
