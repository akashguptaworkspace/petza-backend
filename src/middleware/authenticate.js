import { UnauthorizedError } from '../shared/errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/** Decodes the Bearer access token and attaches { id, role, context } to req.user. Controllers/services derive ownership from this — never from client-supplied ids. */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, context: payload.context };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
