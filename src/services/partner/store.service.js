import { BusinessTypeCapabilities, StoreCapability, StoreStatus } from '../../config/constants.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * The capability a business type is defined by. It can never be switched
 * off: a vet who stops providing care is not a vet, and dropping it would
 * strand every booking their store already has.
 */
function baseCapabilityOf(businessType) {
  return BusinessTypeCapabilities[businessType][0];
}

export const partnerStoreService = {
  /**
   * Turns a pillar on or off for this store — the "my kennel also boards
   * pets and sells food" case.
   *
   * Capabilities are what the partner app's route groups key off, so this
   * is the endpoint that gives a kennel its (care) and (supplies)
   * dashboards. It is deliberately additive-by-listing: the client sends
   * the full set it wants, the server keeps the base capability pinned.
   */
  async updateCapabilities({ userId, capabilities }) {
    const store = await storeRepository.findByOwnerUserId(userId);
    if (!store) throw new NotFoundError('You do not have a store yet');

    // Nothing to widen before Petza staff have verified the business at
    // all — the extra pillars are for a running store, not a shortcut past
    // review.
    if (store.status !== StoreStatus.ACTIVE) {
      throw new ForbiddenError('You can add more to your business once your account is approved');
    }

    const unknown = capabilities.filter((capability) => !StoreCapability[capability]);
    if (unknown.length) throw new BadRequestError(`Unknown capability: ${unknown.join(', ')}`);

    const base = baseCapabilityOf(store.businessType);
    const next = [...new Set([base, ...capabilities])];

    const updated = await storeRepository.update(store, { capabilities: next });

    return { storeId: updated.id, businessType: updated.businessType, capabilities: updated.capabilities ?? [] };
  },
};
