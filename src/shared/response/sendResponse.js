export function sendSuccess(res, { statusCode = 200, message = 'Success', data = null, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendError(res, { statusCode = 500, message = 'Something went wrong', code = 'INTERNAL_ERROR', details } = {}) {
  const body = { success: false, message, error: { code } };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}
