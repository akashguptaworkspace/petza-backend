import { PubliclyVisiblePetStatuses, PubliclyVisibleStoreStatuses } from '../../config/constants.js';
import { petListingRepository } from '../../repositories/shared/petListing.repository.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { wishlistRepository } from '../../repositories/shared/wishlist.repository.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { petListingService } from '../shared/petListing.service.js';
import { storeCatalogService } from './storeCatalog.service.js';

/**
 * A customer's saved pets and stores.
 *
 * The wishlist owns *membership and order* only. The pets and stores
 * themselves are always loaded through the catalogue services, so a saved
 * item is shaped by the one function that decides what a public listing
 * or store looks like — the same reasoning that keeps
 * `listPublicByStore` on the pet service rather than the store one.
 *
 * A sold or paused listing stays visible with its status, matching the
 * catalogue. An explicitly archived listing or suspended store is omitted;
 * its wishlist row survives in case the owner restores it later.
 */
export const wishlistService = {
  /**
   * The whole wishlist in one call — both tabs' contents, newest save
   * first. One round trip, because the app needs both counts to render
   * the tab bar before either tab is opened.
   */
  async listForUser(userId) {
    const rows = await wishlistRepository.findAllForUser(userId);

    const petIds = rows.filter((row) => row.petListingId).map((row) => row.petListingId);
    const storeIds = rows.filter((row) => row.storeId).map((row) => row.storeId);

    const [pets, stores] = await Promise.all([
      petListingService.listPublicByIds(petIds),
      storeCatalogService.listPublicByIds(storeIds),
    ]);

    return { pets, stores };
  },

  /**
   * Saving and unsaving are the same request — the app has one heart
   * button, and the server decides which way it flips from what is
   * already stored. That makes a double-tap idempotent in effect and
   * means the client never has to send a state it might have wrong.
   */
  async togglePet({ userId, petListingId }) {
    const existing = await wishlistRepository.findPet({ userId, petListingId });
    if (existing) {
      await wishlistRepository.removeById(existing.id);
      return { isWishlisted: false };
    }

    // Checked before insert, not after: the FK would reject an unknown id
    // with a driver error, and a listing that exists but isn't public
    // would pass the FK and then never come back from `listForUser` —
    // a heart that stays on until the next app open.
    const listing = await petListingRepository.findPublicByIds({
      ids: [petListingId],
      statuses: PubliclyVisiblePetStatuses,
    });
    if (listing.length === 0) throw new NotFoundError('Pet not found');

    await wishlistRepository.addPet({ userId, petListingId });
    return { isWishlisted: true };
  },

  async toggleStore({ userId, storeId }) {
    const existing = await wishlistRepository.findStore({ userId, storeId });
    if (existing) {
      await wishlistRepository.removeById(existing.id);
      return { isWishlisted: false };
    }

    const stores = await storeRepository.findPublicByIds({
      ids: [storeId],
      statuses: PubliclyVisibleStoreStatuses,
    });
    if (stores.length === 0) throw new NotFoundError('Store not found');

    await wishlistRepository.addStore({ userId, storeId });
    return { isWishlisted: true };
  },
};
