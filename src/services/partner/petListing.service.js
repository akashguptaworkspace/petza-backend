import { PetListingStatus, PetListingType, PetMediaType, PubliclyVisiblePetStatuses } from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { enquiryRepository } from '../../repositories/shared/enquiry.repository.js';
import { resolveAnswers } from '../shared/petAnswerValidation.service.js';
import { petTypeRepository } from '../../repositories/shared/petType.repository.js';
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
    listingType: listing.listingType,
    status: listing.status,
    mainPhotoUrl: mainPhoto?.url ?? null,
    media: media.map((item) => ({ id: item.id, url: item.url, type: item.type, isMain: item.isMain })),
    /** The long tail of the dynamic form, keyed exactly as the form's own attribute keys. */
    attributes: listing.attributes ?? {},
    ...referenceDto(listing),
    ...locationOf(listing),
    /** Real counter, not a placeholder — see the view-count migration. */
    viewCount: listing.viewCount ?? 0,
    createdAt: listing.createdAt,
  };
}

/**
 * The public shape. Adds the seller, drops nothing sensitive — a listing is
 * public by nature, its owner's contact details are not.
 *
 * `store` and `owner` are mutually exclusive: exactly one is non-null,
 * matching whichever column owns the row. The app renders a store badge
 * for the first and a person for the second, and needs no other signal to
 * tell them apart. `owner` deliberately carries a name and nothing else —
 * reaching a private seller goes through the enquiry thread, not through
 * a phone number on a public card.
 */
function toPublicDto(listing) {
  return {
    ...toListingDto(listing),
    listingType: listing.listingType,
    store: listing.store
      ? {
          id: listing.store.id,
          name: listing.store.name,
          slug: listing.store.slug,
          city: listing.store.city,
          isVerified: listing.store.isVerified,
        }
      : null,
    owner: listing.individualOwner
      ? {
          id: listing.individualOwner.id,
          name: listing.individualOwner.name,
          memberSince: listing.individualOwner.createdAt ?? null,
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
/** Trims and length-caps a free-text location part coming off a client. */
function cleanPart(value, max = 120) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * The location a client may attach to a listing it is creating.
 *
 * Read as a whole rather than field by field so a caller cannot send a city
 * without the state it belongs to — the browse feed filters on state first,
 * and a listing with a city but no state would be invisible to it.
 */
function locationColumnsFrom(location) {
  if (!location) return {};
  return {
    city: cleanPart(location.city) ?? null,
    state: cleanPart(location.state) ?? null,
    pincode: cleanPart(location.pincode, 12) ?? null,
    latitude: cleanCoord(location.latitude) ?? null,
    longitude: cleanCoord(location.longitude) ?? null,
  };
}

/**
 * Where a listing is. Its own location when it has one (individuals),
 * otherwise its store's (partners). One function so the DTO, the filters
 * and anything else answer this identically — a listing that a `state=`
 * query matches must also *say* it is in that state.
 */
function locationOf(listing) {
  const own = listing.city || listing.state;
  const source = own ? listing : (listing.store ?? {});
  return {
    city: source.city ?? null,
    state: source.state ?? null,
    pincode: source.pincode ?? null,
    latitude: source.latitude === undefined || source.latitude === null ? null : Number(source.latitude),
    longitude: source.longitude === undefined || source.longitude === null ? null : Number(source.longitude),
  };
}

/**
 * The id columns that mirror the string ones.
 *
 * Both are written, deliberately. The ids are what an admin panel edits
 * against and what survives a rename; the strings are what every existing
 * query and both apps still read. Dropping either side today would break
 * something for no gain — see the normalise-listing-choices migration.
 */
async function referenceColumnsFor(answers, choices) {
  const petType = await petTypeRepository.findByValue(answers.petType);
  const breedChoice = choices.find((choice) => choice.attributeKey === 'breed');

  return {
    petTypeId: petType?.id ?? null,
    // Null when the breed was "Other" — that answer references no option by
    // design, and `breedOther` is where it actually lives.
    breedOptionId: breedChoice?.option?.id ?? null,
  };
}

/** Splits resolved choices into the two normalised tables that hold them. */
function choiceRowsFrom(choices) {
  return {
    colorOptionIds: choices.filter((choice) => choice.attributeKey === 'colors').map((choice) => choice.option.id),
    // Colours and breed have columns of their own; everything else is the
    // long tail this table exists for.
    attributeChoices: choices
      .filter((choice) => choice.attributeKey !== 'colors' && choice.attributeKey !== 'breed')
      .map((choice) => ({ attributeId: choice.attributeId, optionId: choice.option.id })),
  };
}

/**
 * The id half of a listing, beside the string half.
 *
 * Both are returned on purpose. A client that already speaks ids reads
 * `petTypeId` / `breedOptionId` / `colorOptions` / `attributeAnswers` and is
 * immune to an admin renaming anything; a client still reading `petType` /
 * `breed` / `colors` / `attributes` keeps working unchanged. Neither app has
 * to change on the same deploy as the schema.
 *
 * Labels ride along because the whole reason for the ids is that labels are
 * editable — a client holding an id should never have to guess how to
 * display it.
 */
function referenceDto(listing) {
  return {
    petTypeId: listing.petTypeId ?? null,
    petTypeLabel: listing.petTypeRef?.label ?? null,
    breedOptionId: listing.breedOptionId ?? null,
    breedLabel: listing.breedOption?.label ?? null,
    colorOptions: (listing.colorRefs ?? [])
      .filter((row) => row.option)
      .map((row) => ({ id: row.option.id, value: row.option.value, label: row.option.label })),
    attributeAnswers: (listing.attributeValues ?? []).map((row) => ({
      attributeId: row.attributeId,
      attributeKey: row.attribute?.key ?? null,
      optionId: row.optionId,
      value: row.resolvedValue,
      label: row.option?.label ?? null,
    })),
  };
}

function columnsFromAnswers(answers, listingType) {
  const name = String(answers.name ?? '').trim();
  if (!name) throw new BadRequestError('A pet name is required');

  // A rehomed pet has no price, so the requirement follows the listing
  // type rather than being unconditional. A SALE listing still must carry
  // one, whoever published it.
  const priceInInr = toNumber(answers.priceInInr);
  if (listingType === PetListingType.SALE && (priceInInr === null || priceInInr < 0)) {
    throw new BadRequestError('A valid price is required');
  }
  if (priceInInr !== null && priceInInr < 0) throw new BadRequestError('A valid price is required');

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
    // Stored as null rather than 0 on an adoption listing: 0 is a real
    // price a partner may set ("no adoption fee"), so it cannot also mean
    // "no price at all".
    priceInInr: listingType === PetListingType.ADOPTION ? null : priceInInr,
    priceType: listingType === PetListingType.ADOPTION ? null : (answers.priceType ?? null),
    attributes,
  };
}

/**
 * A listing belongs to a store OR to a person, never both and never
 * neither. The columns are nullable so both can exist in one table (see
 * the pet-listings-individual-owners migration), which means this rule
 * lives here — it is also the only place that can raise a readable error
 * rather than a driver-level constraint failure.
 *
 * Both values are server-derived (`req.store.id` / `req.user.id`), so this
 * guards a programming mistake, not user input.
 */
function assertExactlyOneOwner({ storeId, individualOwnerId }) {
  if (!!storeId === !!individualOwnerId) {
    throw new BadRequestError('A listing must belong to either a store or an individual owner');
  }
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
  async create({ storeId, individualOwnerId, listingType = PetListingType.SALE, location, answers, media }) {
    assertExactlyOneOwner({ storeId, individualOwnerId });
    // Before anything is derived from them: an unknown breed or colour is
    // rejected here rather than stored and discovered later. `choices`
    // carries the option rows it resolved, so the normalised tables are
    // written without looking any of them up again.
    const { answers: checkedAnswers, choices } = await resolveAnswers(answers);
    const columns = columnsFromAnswers(checkedAnswers, listingType);
    const references = await referenceColumnsFor(checkedAnswers, choices);
    // Only an individual's listing carries its own location. A partner's
    // stays null and keeps inheriting the store's, which is what stops the
    // two from drifting — the reason the form never asks for one.
    const locationColumns = individualOwnerId ? locationColumnsFrom(location) : {};

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
    const duplicate = await petListingRepository.findLiveByName({ storeId, individualOwnerId, name: columns.name });
    if (duplicate) {
      throw new ConflictError(`You already have a listing called "${duplicate.name}". Give this one a different name.`);
    }

    const listing = await sequelize.transaction(async (transaction) => {
      const created = await petListingRepository.create(
        {
          storeId: storeId ?? null,
          individualOwnerId: individualOwnerId ?? null,
          listingType,
          ...locationColumns,
          ...columns,
          ...references,
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

      await petListingRepository.replaceChoiceRows(
        { petListingId: created.id, ...choiceRowsFrom(choices) },
        { transaction }
      );

      return created;
    });

    // Re-read so the response carries its media, exactly like every later fetch.
    const withMedia = storeId
      ? await petListingRepository.findByIdForStore({ id: listing.id, storeId })
      : await petListingRepository.findByIdForOwner({ id: listing.id, individualOwnerId });
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

    // The partner surface goes through the same check as the customer one —
    // an invalid breed is invalid whoever published it.
    const { answers: checkedAnswers, choices } = await resolveAnswers(answers);
    const columns = columnsFromAnswers(checkedAnswers, existing.listingType);
    const references = await referenceColumnsFor(checkedAnswers, choices);

    const mainCount = media.filter((item) => item.isMain).length;
    if (mainCount !== 1) throw new BadRequestError('A listing needs exactly one main photo');

    const duplicate = await petListingRepository.findLiveByName({ storeId, name: columns.name, excludeId: id });
    if (duplicate) {
      throw new ConflictError(`You already have a listing called "${duplicate.name}". Give this one a different name.`);
    }

    await sequelize.transaction(async (transaction) => {
      await petListingRepository.update(existing, { ...columns, ...references }, { transaction });
      await petListingRepository.replaceChoiceRows(
        { petListingId: id, ...choiceRowsFrom(choices) },
        { transaction }
      );
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

  /**
   * ---------------------------------------------------------------------
   * Individually-owned listings — a customer's own pets.
   *
   * These are twins of the store methods above and deliberately share this
   * service rather than getting one of their own: `create` above already
   * handles both owners, so a listing is shaped by ONE function whoever
   * published it. A parallel customer service would be a second definition
   * of what a valid listing is, and the two would drift.
   * ---------------------------------------------------------------------
   */

  async listForOwner({ individualOwnerId, status, petType, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await petListingRepository.findAndCountForOwner({
      individualOwnerId,
      status,
      petType,
      search,
      limit,
      offset,
    });

    // One grouped query for the whole page rather than a COUNT per row.
    const messagesByListing = await enquiryRepository.countCustomerMessagesByListingIds(rows.map((row) => row.id));

    return {
      items: rows.map((row) => ({
        ...toListingDto(row),
        messageCount: messagesByListing[row.id] ?? 0,
      })),
      meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) },
    };
  },

  async getForOwner({ id, individualOwnerId }) {
    const listing = await petListingRepository.findByIdForOwner({ id, individualOwnerId });
    if (!listing) throw new NotFoundError('Listing not found');

    const messagesByListing = await enquiryRepository.countCustomerMessagesByListingIds([listing.id]);
    return { ...toListingDto(listing), messageCount: messagesByListing[listing.id] ?? 0 };
  },

  /**
   * `listingType` may change here, but only ONE WAY: SALE → ADOPTION.
   *
   * Deciding to give away a pet you were selling is a normal change of
   * mind, and blocking it would push people into deleting and relisting —
   * losing the listing's enquiry thread with it. The reverse is not
   * symmetric: someone who applied for a pet offered free would find
   * themselves looking at a price they never agreed to, so ADOPTION is
   * terminal.
   *
   * Enforced here rather than in the validator because it is a transition
   * rule — it depends on what is already stored, which a body schema
   * cannot see.
   */
  async updateForOwner({ id, individualOwnerId, listingType, answers, media, location }) {
    const existing = await petListingRepository.findByIdForOwner({ id, individualOwnerId });
    if (!existing) throw new NotFoundError('Listing not found');

    const nextListingType = listingType ?? existing.listingType;
    if (existing.listingType === PetListingType.ADOPTION && nextListingType === PetListingType.SALE) {
      throw new BadRequestError('A rehoming listing cannot be changed back to a sale. Create a new listing instead.');
    }

    const { answers: checkedAnswers, choices } = await resolveAnswers(answers);
    const columns = columnsFromAnswers(checkedAnswers, nextListingType);
    const references = await referenceColumnsFor(checkedAnswers, choices);

    const mainCount = media.filter((item) => item.isMain).length;
    if (mainCount !== 1) throw new BadRequestError('A listing needs exactly one main photo');

    const duplicate = await petListingRepository.findLiveByName({
      individualOwnerId,
      name: columns.name,
      excludeId: id,
    });
    if (duplicate) {
      throw new ConflictError(`You already have a listing called "${duplicate.name}". Give this one a different name.`);
    }

    await sequelize.transaction(async (transaction) => {
      // `columns` already carries the null price when switching to
      // ADOPTION — columnsFromAnswers was given the *next* type above, so
      // the type and the price can never be written out of step.
      // Omitted leaves the stored location alone — an owner editing without
      // moving shouldn't have to resend it.
      const locationUpdate = location ? locationColumnsFrom(location) : {};
      await petListingRepository.update(
        existing,
        { ...columns, ...references, listingType: nextListingType, ...locationUpdate },
        { transaction }
      );
      await petListingRepository.replaceChoiceRows(
        { petListingId: existing.id, ...choiceRowsFrom(choices) },
        { transaction }
      );
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

    return toListingDto(await petListingRepository.findByIdForOwner({ id, individualOwnerId }));
  },

  /** "Mark as rehomed / sold", "Pause", "Relist", "Remove" on the customer's own listing. */
  async updateStatusForOwner({ id, individualOwnerId, status }) {
    const existing = await petListingRepository.findByIdForOwner({ id, individualOwnerId });
    if (!existing) throw new NotFoundError('Listing not found');

    if (existing.status === PetListingStatus.ARCHIVED) {
      throw new BadRequestError('This listing has been removed and can no longer be changed');
    }

    await petListingRepository.update(existing, { status });
    return toListingDto(await petListingRepository.findByIdForOwner({ id, individualOwnerId }));
  },

  /** The public catalogue — what petza-app browses. */
  async listPublic({
    listingType,
    excludeOwnerId,
    individualOnly,
    city,
    state,
    petType,
    breed,
    gender,
    size,
    minPrice,
    maxPrice,
    search,
    page = 1,
    limit = 20,
  }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await petListingRepository.findAndCountPublic({
      statuses: PubliclyVisiblePetStatuses,
      listingType,
      excludeOwnerId,
      individualOnly,
      city,
      state,
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

  /**
   * The public detail page — and the only place a view is counted.
   *
   * `viewerId` is whoever is asking, or undefined for a guest. An owner
   * opening their own listing does NOT count: the number exists to tell them
   * how much interest the pet is getting, and checking on it would otherwise
   * be the fastest way to inflate it.
   *
   * The increment is fire-and-forget. It is a counter, not the response —
   * failing to record a view must never turn a working page into an error,
   * so a rejection is swallowed rather than propagated.
   */
  async getPublic(idOrSlug, { viewerId } = {}) {
    const listing = await petListingRepository.findOnePublic({
      idOrSlug,
      statuses: PubliclyVisiblePetStatuses,
    });
    if (!listing) throw new NotFoundError('Pet not found');

    const isOwnListing = viewerId && listing.individualOwnerId === viewerId;
    if (!isOwnListing) {
      petListingRepository.incrementViewCount(listing.id).catch(() => {});
    }

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

  /**
   * The listings behind a set of ids, in the caller's own id order —
   * backs the wishlist, which owns the ordering (most recently saved
   * first) and only knows ids.
   *
   * Ids whose listing is no longer public are simply absent from the
   * result. That is the intended behaviour, not a gap to fill with a
   * placeholder: a sold or archived pet leaves the wishlist rather than
   * sitting there as a card nobody can act on.
   */
  async listPublicByIds(ids) {
    const listings = await petListingRepository.findPublicByIds({
      ids,
      statuses: PubliclyVisiblePetStatuses,
    });
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    return ids.filter((id) => byId.has(id)).map((id) => toPublicDto(byId.get(id)));
  },
};
