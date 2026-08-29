import { AvailablePetStatuses, PubliclyVisibleStoreStatuses } from '../../config/constants.js';
import { petListingRepository } from '../../repositories/shared/petListing.repository.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

/**
 * The public store directory — what petza-app's Stores tab lists.
 *
 * Deliberately a customer-context service of its own rather than public
 * methods bolted onto services/partner/store.service.js: that service is
 * about a partner *owning and editing* their store (KYC, capabilities,
 * approval), while this one is about a customer *browsing* stores. They
 * read the same table but answer different questions, and a public DTO
 * living next to KYC mutations is how an owner-only field ends up leaking.
 */

/**
 * Short service labels for a store card, derived from what the store
 * genuinely is and does. Not free-text marketing tags: there is no such
 * column, and inventing one per store would be fabricated data.
 *
 * These used to lead with the business type ("Pets & Breeding",
 * "Veterinary") because the type *was* what a partner did. It no longer is
 * — a clinic that also sells food and a store that also grooms are both
 * ordinary now — so the tags describe the capabilities instead, which is
 * the thing that actually differs between two stores of the same type.
 */
const BUSINESS_TYPE_TAG = {
  INDIVIDUAL: 'Individual seller',
  STORE: 'Store',
  CLINIC: 'Clinic',
  GROOMER: 'Groomer',
};

function tagsFor(store) {
  const tags = [];
  if (store.offersProducts) tags.push('Supplies');
  if (store.offersServices) tags.push('Services');

  const typeTag = BUSINESS_TYPE_TAG[store.businessType];
  if (typeTag) tags.push(typeTag);

  return tags;
}

/**
 * What a customer is allowed to see of a store.
 *
 * Everything here is a real column or a real count. Fields petza-app's UI
 * can also render — rating, review count, opening hours, banner/hero
 * photography, distance, a street address — are **absent on purpose**:
 * there is no reviews table, no store hours, no store media table and no
 * geocoding in the schema yet. The app treats them as optional and hides
 * what is missing, which is the honest rendering; sending a placeholder
 * `4.5` or a stock photo here would put invented data on a real business's
 * card. Add each one to this DTO as (and only as) the schema grows to hold
 * it.
 *
 * `email` and the owner's name are omitted deliberately — `ownerName` is
 * the human on the KYC documents, not a public-facing identity.
 */
function toPublicDto(store, availablePetCount) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    businessType: store.businessType,
    offersProducts: store.offersProducts,
    offersServices: store.offersServices,
    tags: tagsFor(store),
    city: store.city,
    // Nullable in the schema (KYC does not require it) — the app only
    // renders a "Call Store" button when this is actually present.
    phone: store.phone,
    isVerified: store.isVerified,
    availablePetCount,
    createdAt: store.createdAt,
  };
}

export const storeCatalogService = {
  async listPublic({ search, city, businessType, capability, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await storeRepository.findAndCountPublic({
      statuses: PubliclyVisibleStoreStatuses,
      search,
      city,
      businessType,
      capability,
      limit,
      offset,
    });

    // One grouped query for the whole page rather than a COUNT per card.
    const petCounts = await petListingRepository.countPublicByStoreIds({
      storeIds: rows.map((store) => store.id),
      statuses: AvailablePetStatuses,
    });

    return {
      items: rows.map((store) => toPublicDto(store, petCounts[store.id] ?? 0)),
      meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) },
    };
  },

  async getPublic(idOrSlug) {
    const store = await storeRepository.findOnePublic({
      idOrSlug,
      statuses: PubliclyVisibleStoreStatuses,
    });
    if (!store) throw new NotFoundError('Store not found');

    const petCounts = await petListingRepository.countPublicByStoreIds({
      storeIds: [store.id],
      statuses: AvailablePetStatuses,
    });

    return toPublicDto(store, petCounts[store.id] ?? 0);
  },

  /**
   * The stores behind a set of ids, in the caller's own id order — backs
   * the wishlist, which owns the ordering (most recently saved first) and
   * only knows ids.
   *
   * Ids whose store is no longer publicly visible are absent from the
   * result, deliberately: a suspended store drops off the wishlist rather
   * than rendering a card that leads nowhere.
   */
  async listPublicByIds(ids) {
    const stores = await storeRepository.findPublicByIds({
      ids,
      statuses: PubliclyVisibleStoreStatuses,
    });

    // One grouped query for the whole set, same as listPublic.
    const petCounts = await petListingRepository.countPublicByStoreIds({
      storeIds: stores.map((store) => store.id),
      statuses: AvailablePetStatuses,
    });

    const byId = new Map(stores.map((store) => [store.id, store]));
    return ids
      .filter((id) => byId.has(id))
      .map((id) => toPublicDto(byId.get(id), petCounts[id] ?? 0));
  },
};
