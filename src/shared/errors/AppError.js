import { ErrorCodes } from '../constants/errorCodes.js';

/** Base class for all typed, expected application errors — thrown from services/repositories, caught by errorHandler middleware. */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details) {
    super(message, 400, ErrorCodes.BAD_REQUEST, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(message, 422, ErrorCodes.VALIDATION_ERROR, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, ErrorCodes.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, ErrorCodes.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, ErrorCodes.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(message, 409, ErrorCodes.CONFLICT, details);
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Payment failed', details) {
    super(message, 402, ErrorCodes.PAYMENT_ERROR, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details) {
    super(message, 429, ErrorCodes.TOO_MANY_REQUESTS, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503, ErrorCodes.SERVICE_UNAVAILABLE);
  }
}
