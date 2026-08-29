import { PartnerCapability, StoreStatus } from '../../config/constants.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * Maps the capability the client names onto the column it sets. The two
 * are kept separate so the wire format stays PRODUCTS/SERVICES — what the
 * partner picked — rather than leaking column names into the API.
 */
const CAPABILITY_COLUMN = Object.freeze({
  [PartnerCapability.PRODUCTS]: 'offersProducts',
  [PartnerCapability.SERVICES]: 'offersServices',
});

export const partnerStoreService = {
  /**
   * The "grow your business" flow's last step — PRODUCT_CONTEXT.md §7.
   *
   * **Additive only.** The client names the capabilities it wants turned
   * *on*; anything already on stays on. There is no path here that sets a
   * flag back to false, and that is deliberate (§3): switching services
   * off would orphan every booking already in a customer's calendar, and
   * switching products off would strand in-flight orders. A partner
   * winding down pauses their listings instead, which leaves the
   * transactions that are already running intact.
   *
   * Once a flag flips, the app's `Products | Services` and
   * `Orders | Bookings` segmented controls appear on their own — every
   * screen already reads the flags, so nothing else has to change.
   */
  async enableCapabilities({ userId, capabilities }) {
    const store = await storeRepository.findByOwnerUserId(userId);
    if (!store) throw new NotFoundError('You do not have a store yet');

    // Nothing to widen before Petza staff have verified the business at
    // all — growing is for a running store, not a shortcut past review.
    if (store.status !== StoreStatus.ACTIVE) {
      throw new ForbiddenError('You can add more to your business once your account is approved');
    }

    const unknown = capabilities.filter((capability) => !CAPABILITY_COLUMN[capability]);
    if (unknown.length) throw new BadRequestError(`Unknown capability: ${unknown.join(', ')}`);

    const changes = {};
    for (const capability of capabilities) changes[CAPABILITY_COLUMN[capability]] = true;

    const updated = await storeRepository.update(store, changes);

    return {
      storeId: updated.id,
      businessType: updated.businessType,
      offersProducts: updated.offersProducts,
      offersServices: updated.offersServices,
    };
  },
};
