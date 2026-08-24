import { ForbiddenError } from '../shared/errors/AppError.js';

/** Gate a route to specific contexts (CUSTOMER/PARTNER/ADMIN) or roles — always after `authenticate`. */
export function authorize(...allowed) {
  return (req, res, next) => {
    const isAllowed = req.user && (allowed.includes(req.user.context) || allowed.includes(req.user.role));
    if (!isAllowed) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}
