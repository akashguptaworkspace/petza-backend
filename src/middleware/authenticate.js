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

/**
 * Same decode, but a missing or unusable token is not an error — it just
 * leaves `req.user` undefined and the request continues as a guest.
 *
 * For routes that are public but behave differently once they know who is
 * looking. The Adopt / Rehome feed is the case that needed it: browsing is
 * open to guests (a shared listing link has to work without an account),
 * yet a signed-in viewer must not be shown the pet they are themselves
 * trying to rehome. Gating that feed with `authenticate` would have made
 * the whole thing sign-in-only to serve one filter.
 *
 * An invalid token is deliberately swallowed rather than rejected: the
 * route grants nothing on the strength of `req.user` here, it only
 * subtracts the viewer's own rows, so the worst a bad token can do is show
 * someone slightly more than they'd otherwise see. Anything that GRANTS
 * access must use `authenticate` instead.
 */
export function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, context: payload.context };
  } catch {
    // Guest for this request. See above for why this isn't a 401.
  }
  next();
}
