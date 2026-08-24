import { ZodError } from 'zod';

import { ErrorCodes } from '../shared/constants/errorCodes.js';
import { AppError } from '../shared/errors/AppError.js';
import { sendError } from '../shared/response/sendResponse.js';
import { logger } from '../utils/logger.js';

/** Normalizes any thrown error (typed AppError, Zod, Sequelize, or unexpected) into the shared error response envelope. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (process.env.NODE_ENV !== 'test') logger.warn(`${err.code} ${err.message}`);
    return sendError(res, { statusCode: err.statusCode, message: err.message, code: err.code, details: err.details });
  }

  if (err instanceof ZodError) {
    return sendError(res, {
      statusCode: 422,
      message: 'Validation failed',
      code: ErrorCodes.VALIDATION_ERROR,
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return sendError(res, { statusCode: 409, message: 'Resource already exists', code: ErrorCodes.CONFLICT });
  }

  if (err.name === 'SequelizeValidationError') {
    return sendError(res, {
      statusCode: 422,
      message: 'Validation failed',
      code: ErrorCodes.VALIDATION_ERROR,
      details: err.errors?.map((e) => ({ path: e.path, message: e.message })),
    });
  }

  logger.error(err.stack || err.message);
  return sendError(res, {
    statusCode: 500,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message,
    code: ErrorCodes.INTERNAL_ERROR,
  });
}
