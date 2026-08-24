import { PetListingStatus, PetMediaType, PubliclyVisiblePetStatuses } from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { petListingRepository } from '../../repositories/shared/petListing.repository.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * Answer keys that get their own column, because something filters or
 * sorts on them. Everything else the dynamic form collects falls through
 * to the `attributes` JSON untouched — which is what lets a new question be
 * added to `pet-form-schema.cjs` and start being saved with no change here.
 *
 * The client posts the whole answer map exactly as the form produced it and
 * does not know this split exists; deciding it here is what keeps the app a
 * renderer.
 */
const COLUMN_KEYS = new Set([
  'name',
  'petType',
  'gender',
  'dateOfBirth',
  'age',
  'colors',
  'size',
  'weightKg',
  'description',
  'breed',
  'breedOther',
  'priceInInr',
  'priceType',
]);

/** The sentinel the app uses for a picked "Other". Mirrors OTHER_VALUE in petza-partner's DynamicField.tsx. */
const OTHER_VALUE = '__other__';

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** Appends -2, -3, … until the slug is free. */
async function uniqueSlug(name, transaction) {
  const base = slugify(name) || 'pet';
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await petListingRepository.findBySlug(candidate, { transaction });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Age recomputed from the date of birth rather than trusted from the
 * client. The app derives it for display, but a listing that says "3
 * months" forever because it was written once is worse than no label —
 * this is refreshed on every read of the DTO.
 */
function ageLabelFor(dateOfBirth) {
  if (!dateOfBirth) return null;

  const birth = new Date(dateOfBirth);
  const today = new Date();

  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;

  if (months < 12) return months <= 1 ? '1 month' : `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Never return the model. Shared by the partner's list and its detail screen. */
function toListingDto(listing) {
  const media = listing.media ?? [];
  const mainPhoto = media.find((item) => item.isMain) ?? media.find((item) => item.type === PetMediaType.PHOTO);

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    petType: listing.petType,
    breed: listing.breedOther ?? listing.breed,
    gender: listing.gender,
    size: listing.size,
    colors: listing.colors ?? [],
    dateOfBirth: listing.dateOfBirth,
    ageLabel: ageLabelFor(listing.dateOfBirth) ?? listing.ageLabel,
    weightKg: listing.weightKg === null ? null : Number(listing.weightKg),
    description: listing.description,
    priceInInr: listing.priceInInr,
    priceType: listing.priceType,
    status: listing.status,
    mainPhotoUrl: mainPhoto?.url ?? null,
    media: media.map((item) => ({ id: item.id, url: item.url, type: item.type, isMain: item.isMain })),
    /** The long tail of the dynamic form, keyed exactly as the form's own attribute keys. */
    attributes: listing.attributes ?? {},
    createdAt: listing.createdAt,
  };
}

/** The public shape. Adds the seller, drops nothing sensitive — a listing is public by nature, its owner's contact details are not. */
function toPublicDto(listing) {
  return {
    ...toListingDto(listing),
    store: listing.store
      ? {
          id: listing.store.id,
          name: listing.store.name,
          slug: listing.store.slug,
          city: listing.store.city,
          isVerified: listing.store.isVerified,
        }
      : null,
  };
}

/**
 * `answers` → the columns a listing write needs, shared by `create` and
 * `update` so the two can never drift on which keys become columns, which
 * "Other" handling applies, or how age is derived.
 *
 * Throws on the two the service cannot work without; everything else the
 * form asked falls through to `attributes` untouched.
 */
function columnsFromAnswers(answers) {
  const name = String(answers.name ?? '').trim();
  if (!name) throw new BadRequestError('A pet name is required');

  const priceInInr = toNumber(answers.priceInInr);
  if (priceInInr === null || priceInInr < 0) throw new BadRequestError('A valid price is required');

  const attributes = Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => !COLUMN_KEYS.has(key) && value !== undefined && value !== '')
  );

  const dateOfBirth = answers.dateOfBirth || null;

  return {
    name,
    petType: answers.petType,
    // A picked "Other" is not a breed — the free-text answer beside it is.
    breed: answers.breed === OTHER_VALUE ? null : (answers.breed ?? null),
    breedOther: answers.breed === OTHER_VALUE ? (answers.breedOther ?? null) : null,
    gender: answers.gender ?? null,
    size: answers.size ?? null,
    colors: Array.isArray(answers.colors) ? answers.colors : [],
    dateOfBirth,
    ageLabel: ageLabelFor(dateOfBirth),
    weightKg: toNumber(answers.weightKg),
    description: answers.description ?? null,
    priceInInr,
    priceType: answers.priceType ?? null,
    attributes,
  };
}

export const petListingService = {
  /**
   * Publishes a listing.
   *
   * `answers` arrives as the form produced it — every question's key mapped
   * to its answer — and is split here into columns and the `attributes`
   * blob. Status is set, never accepted: a listing being created is
   * available by definition, which is why the form does not ask.
   */
  async create({ storeId, answers, media }) {
    const columns = columnsFromAnswers(answers);

    const mainCount = media.filter((item) => item.isMain).length;
    if (mainCount !== 1) throw new BadRequestError('A listing needs exactly one main photo');

    /**
     * One live listing per name, per store.
     *
     * The immediate cause is a double-tapped Publish button, but a retry
     * guard would only cover that window — and the real problem is longer
     * lived: two "Bruno" cards in one kennel's list are indistinguishable
     * to the partner managing them and to the buyer browsing them.
     *
     * Deliberately not silently returning the existing listing: that would
     * hide a genuine second puppy behind a success message. The partner is
     * told, and names it something else.
     */
    const duplicate = await petListingRepository.findLiveByName({ storeId, name: columns.name });
    if (duplicate) {
      throw new ConflictError(`You already have a listing called "${duplicate.name}". Give this one a different name.`);
    }

    const listing = await sequelize.transaction(async (transaction) => {
      const created = await petListingRepository.create(
        {
          storeId,
          ...columns,
          slug: await uniqueSlug(columns.name, transaction),
          status: PetListingStatus.AVAILABLE,
        },
        { transaction }
      );

      await petListingRepository.createMedia(
        media.map((item, index) => ({
          petListingId: created.id,
          url: item.url,
          type: item.type,
          isMain: item.isMain,
          position: index,
        })),
        { transaction }
      );

      return created;
    });

    // Re-read so the response carries its media, exactly like every later fetch.
    const withMedia = await petListingRepository.findByIdForStore({ id: listing.id, storeId });
    return toListingDto(withMedia);
  },

  /**
   * Saves changes to an existing listing.
   *
   * Same validation and column split as `create` — an edit is a full
   * republish of the answer map, not a partial patch, so the two paths
   * cannot disagree on what a valid listing looks like. The slug and status
   * are left alone: renaming the pet does not need a new share link, and
   * status is a moderation/availability concern this endpoint doesn't touch.
   *
   * Media is replaced wholesale (delete the old rows, insert what the app
   * sent) rather than diffed — the app always posts the complete gallery it
   * wants the listing to have, including untouched tiles carrying their
   * existing URL, so there is nothing to reconcile.
   */
  async update({ id, storeId, answers, media }) {
    const existing = await petListingRepository.findByIdForStore({ id, storeId });
    if (!existing) throw new NotFoundError('Listing not found');

    const columns = columnsFromAnswers(answers);

    const mainCount = media.filter((item) => item.isMain).length;
    if (mainCount !== 1) throw new BadRequestError('A listing needs exactly one main photo');

    const duplicate = await petListingRepository.findLiveByName({ storeId, name: columns.name, excludeId: id });
    if (duplicate) {
      throw new ConflictError(`You already have a listing called "${duplicate.name}". Give this one a different name.`);
    }

    await sequelize.transaction(async (transaction) => {
      await petListingRepository.update(existing, columns, { transaction });
      await petListingRepository.deleteMediaForListing(id, { transaction });
      await petListingRepository.createMedia(
        media.map((item, index) => ({
          petListingId: id,
          url: item.url,
          type: item.type,
          isMain: item.isMain,
          position: index,
        })),
        { transaction }
      );
    });

    const withMedia = await petListingRepository.findByIdForStore({ id, storeId });
    return toListingDto(withMedia);
  },

  /**
   * The status buttons on the pet detail screen — Mark as Sold, Pause,
   * Relist, Make Live Again — and its "Remove Listing" menu action.
   * Deliberately its own endpoint rather than folded into `update`: a status
   * change carries no answer map or media, and the validator only allows the
   * statuses a partner may set directly (see
   * `PartnerSettablePetListingStatuses`) — RESERVED stays out of reach here.
   *
   * ARCHIVED is one-way: once a listing is archived (soft-deleted via
   * Remove Listing), no further call through this endpoint can move it back
   * out. Restoring a removed listing, if that's ever wanted, is a
   * moderation/admin action, not a button on this screen.
   */
  async updateStatusForStore({ id, storeId, status }) {
    const existing = await petListingRepository.findByIdForStore({ id, storeId });
    if (!existing) throw new NotFoundError('Listing not found');

    if (existing.status === PetListingStatus.ARCHIVED) {
      throw new BadRequestError('This listing has been removed and can no longer be changed');
    }

    await petListingRepository.update(existing, { status });

    const withMedia = await petListingRepository.findByIdForStore({ id, storeId });
    return toListingDto(withMedia);
  },

  async listForStore({ storeId, status, petType, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await petListingRepository.findAndCountForStore({
      storeId,
      status,
      petType,
      search,
      limit,
      offset,
    });

    return {
      items: rows.map(toListingDto),
      meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) },
    };
  },

  async getForStore({ id, storeId }) {
    const listing = await petListingRepository.findByIdForStore({ id, storeId });
    if (!listing) throw new NotFoundError('Listing not found');
    return toListingDto(listing);
  },

  /** The public catalogue — what petza-app browses. */
  async listPublic({ petType, breed, gender, size, minPrice, maxPrice, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await petListingRepository.findAndCountPublic({
      statuses: PubliclyVisiblePetStatuses,
      petType,
      breed,
      gender,
      size,
      minPrice,
      maxPrice,
      search,
      limit,
      offset,
    });

    return {
      items: rows.map(toPublicDto),
      meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) },
    };
  },

  async getPublic(idOrSlug) {
    const listing = await petListingRepository.findOnePublic({
      idOrSlug,
      statuses: PubliclyVisiblePetStatuses,
    });
    if (!listing) throw new NotFoundError('Pet not found');
    return toPublicDto(listing);
  },

  /**
   * Every publicly-buyable pet for one store — backs the store-details
   * page's own list. Lives here rather than in the store catalogue service
   * so a pet is still shaped by the one function that decides what a
   * public listing looks like (`toPublicDto`), whichever screen asked.
   */
  async listPublicByStore(storeId) {
    const listings = await petListingRepository.findPublicByStoreId({
      storeId,
      statuses: PubliclyVisiblePetStatuses,
    });
    return listings.map(toPublicDto);
  },
};
