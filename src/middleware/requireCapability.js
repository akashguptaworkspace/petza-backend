import { storeRepository } from '../repositories/shared/store.repository.js';
import { ForbiddenError } from '../shared/errors/AppError.js';

/**
 * Gates a partner surface on what the store can actually do.
 *
 * `authorize(Context.PARTNER)` only says "this is a partner"; a pillar
 * needs more than that — a kennel with no SELL_SUPPLIES capability has no
 * business writing a product catalogue. petza-partner guards its route
 * groups the same way client-side, but that is a convenience: this is the
 * check that counts (PLATFORM_CONTEXT.md §10/R15).
 *
 * It also resolves the store, so downstream controllers can read
 * `req.store.id` instead of trusting a body-supplied storeId.
 */
export function requireCapability(capability) {
  return async (req, res, next) => {
    try {
      const store = await storeRepository.findByOwnerUserId(req.user.id);
      if (!store) return next(new ForbiddenError('You do not have a store yet'));

      if (!(store.capabilities ?? []).includes(capability)) {
        return next(new ForbiddenError('This part of Petza is not enabled for your business'));
      }

      req.store = store;
      next();
    } catch (error) {
      next(error);
    }
  };
}
