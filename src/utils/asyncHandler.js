/** Wraps an async route/controller handler so a rejected promise reaches errorHandler via next(), instead of crashing the process. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
