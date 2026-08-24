import { NotFoundError } from '../shared/errors/AppError.js';

export function notFound(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
