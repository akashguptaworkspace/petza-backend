import { PubliclyVisiblePetStatuses, PubliclyVisibleStoreStatuses } from '../../config/constants.js';
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
 * The one profile row a store actually has, whichever type it is.
 * `businessType` decides which association is populated; the other four
 * are always null (see store.repository's PROFILE_INCLUDE).
 */
function profileOf(store) {
  return (
    store.kennelProfile ??
    store.vetProfile ??
    store.trainerProfile ??
    store.groomerProfile ??
    store.supplierProfile ??
    null
  );
}

/**
 * Short service labels for a store card, derived from what the store
 * genuinely is and does — its business type and the capabilities an admin
 * actually granted it. Not free-text marketing tags: there is no such
 * column, and inventing one per store would be fabricated data.
 */
const BUSINESS_TYPE_TAG = {
  KENNEL: 'Pets & Breeding',
  VET: 'Veterinary',
  TRAINER: 'Training',
  GROOMER: 'Grooming',
  SUPPLIER: 'Supplies',
};

const CAPABILITY_TAG = {
  SELL_PETS: 'Pets',
  SELL_SUPPLIES: 'Supplies',
  PROVIDE_CARE: 'Care',
};

/**
 * The capability every business type already implies, so its tag isn't
 * repeated: a KENNEL tagged "Pets & Breeding" does not also need "Pets",
 * and a VET tagged "Veterinary" does not also need "Care". Only the
 * capabilities a store has *beyond* its type say something new about it.
 */
const IMPLIED_CAPABILITY = {
  KENNEL: 'SELL_PETS',
  VET: 'PROVIDE_CARE',
  TRAINER: 'PROVIDE_CARE',
  GROOMER: 'PROVIDE_CARE',
  SUPPLIER: 'SELL_SUPPLIES',
};

function tagsFor(store) {
  const tags = [BUSINESS_TYPE_TAG[store.businessType]].filter(Boolean);
  const implied = IMPLIED_CAPABILITY[store.businessType];

  for (const capability of store.capabilities ?? []) {
    if (capability === implied) continue;
    const label = CAPABILITY_TAG[capability];
    if (label && !tags.includes(label)) tags.push(label);
  }
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
  const profile = profileOf(store);

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    businessType: store.businessType,
    capabilities: store.capabilities ?? [],
    tags: tagsFor(store),
    city: store.city,
    // Nullable in the schema (KYC does not require it) — the app only
    // renders a "Call Store" button when this is actually present.
    phone: store.phone,
    isVerified: store.isVerified,
    availablePetCount,
    // Kennel-only in practice; the other profile tables have their own
    // shapes and simply do not carry these, so they come back undefined.
    experienceYears: profile?.yearsActive ?? null,
    pincode: profile?.pincode ?? null,
    breeds: profile?.breeds ?? [],
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
      statuses: PubliclyVisiblePetStatuses,
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
      statuses: PubliclyVisiblePetStatuses,
    });

    return toPublicDto(store, petCounts[store.id] ?? 0);
  },
};
