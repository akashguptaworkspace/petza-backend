import { ForbiddenError, UnauthorizedError } from '../shared/errors/AppError.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Gate for POST /system/seed — the one route that migrates + seeds a
 * brand-new database in one Postman call.
 *
 * Two ways in, because the route has to work on a VM where nothing exists
 * yet AND stay safe once real data does:
 *
 *   1. `X-Seed-Key` header matching env `SEED_KEY` — the bootstrap path.
 *      No user, let alone an admin one, exists on a fresh database, so the
 *      first call on a new VM can't be gated behind login.
 *   2. A normal admin Bearer token (Context.ADMIN) — once the seeders have
 *      created an admin login, re-seeding can go through the same auth
 *      every other admin action uses, no key required.
 *
 * Hard-blocked in production unless an operator explicitly opts in via
 * `ALLOW_SEED_ROUTE=true` — this can drop tables' worth of demo data back
 * on top of real rows, so the default has to be "off", not "gated".
 */
export function seedAccess(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowInProduction = process.env.ALLOW_SEED_ROUTE === 'true';

  if (isProduction && !allowInProduction) {
    return next(new ForbiddenError('Seeding is disabled in production. Set ALLOW_SEED_ROUTE=true to override.'));
  }

  const providedKey = req.headers['x-seed-key'];
  const seedKey = process.env.SEED_KEY;

  if (seedKey && providedKey === seedKey) {
    logger.warn('Seed route authorized via X-Seed-Key');
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      if (payload.context === 'ADMIN') {
        req.user = { id: payload.sub, role: payload.role, context: payload.context };
        return next();
      }
    } catch {
      // Falls through to the error below — an invalid token here is
      // reported the same as no token, not distinguished for an attacker.
    }
  }

  return next(new UnauthorizedError('Seeding requires an admin token or a valid X-Seed-Key header'));
}
