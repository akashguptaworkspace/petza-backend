import { PartnerCapability } from '../config/constants.js';
import { storeRepository } from '../repositories/shared/store.repository.js';
import { ForbiddenError } from '../shared/errors/AppError.js';

/** Which column on the store backs each capability. */
const CAPABILITY_COLUMN = Object.freeze({
  [PartnerCapability.PRODUCTS]: 'offersProducts',
  [PartnerCapability.SERVICES]: 'offersServices',
});

/**
 * Gates a partner surface on what the store actually offers.
 *
 * `authorize(Context.PARTNER)` only says "this is a partner". Writing a
 * product catalogue needs more than that — a services-only groomer has no
 * business posting supplies. petza-partner hides the same surfaces
 * client-side, but that is a convenience: this is the check that counts
 * (PLATFORM_CONTEXT.md §10/R15).
 *
 * It also resolves the store, so downstream controllers read `req.store.id`
 * instead of trusting a body-supplied storeId.
 */
export function requireCapability(capability) {
  const column = CAPABILITY_COLUMN[capability];

  return async (req, res, next) => {
    try {
      const store = await storeRepository.findByOwnerUserId(req.user.id);
      if (!store) return next(new ForbiddenError('You do not have a store yet'));

      if (!store[column]) {
        return next(
          new ForbiddenError(
            capability === PartnerCapability.SERVICES
              ? 'Turn on services for your business to use this'
              : 'Turn on pet supplies for your business to use this'
          )
        );
      }

      req.store = store;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * The same store resolution without a capability check, for surfaces every
 * partner reaches regardless of what they offer — the dashboard, the
 * wallet, their profile. Without this those controllers would each repeat
 * the lookup, or worse, take a storeId from the client.
 */
export function requireStore(req, res, next) {
  storeRepository
    .findByOwnerUserId(req.user.id)
    .then((store) => {
      if (!store) return next(new ForbiddenError('You do not have a store yet'));
      req.store = store;
      next();
    })
    .catch(next);
}
