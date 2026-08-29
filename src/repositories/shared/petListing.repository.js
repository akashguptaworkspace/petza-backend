import { Op } from 'sequelize';

import db from '../../models/index.js';
import { citiesInState } from '../../utils/indiaLocations.js';

const { PetAttribute, PetAttributeOption, PetListing, PetListingAttributeValue, PetListingColor, PetListingMedia, PetType, Store, User } = db;

/** Media always comes back in display order, main photo first, so no caller has to sort it. */
const MEDIA_INCLUDE = { model: PetListingMedia, as: 'media' };
const MEDIA_ORDER = [
  [{ model: PetListingMedia, as: 'media' }, 'isMain', 'DESC'],
  [{ model: PetListingMedia, as: 'media' }, 'position', 'ASC'],
];

/** The seller shown on a public listing. Never the whole store row — that carries the owner's contact details. */
const STORE_INCLUDE = {
  model: Store,
  as: 'store',
  // `state` is selected, not just filtered on: `locationOf` labels a
  // partner listing from its store, and without the column the DTO said
  // `state: null` for a pet the `state=` filter had just matched — the
  // label and the filter disagreeing about the same row.
  attributes: ['id', 'name', 'slug', 'city', 'state', 'isVerified'],
};

/**
 * The person shown on an individually-listed pet. Name only — never the
 * whole user row, which carries their email and phone. A rehoming listing
 * is public; its owner's contact details are not, and reaching them is
 * what the enquiry thread is for.
 */
const OWNER_INCLUDE = {
  model: User,
  as: 'individualOwner',
  // `createdAt` backs the app's "Member since March 2026" line — the only
  // trust signal a private seller has, since there is no individual KYC.
  attributes: ['id', 'name', 'createdAt'],
};

/** Every public read carries both possible sellers; exactly one resolves. */
/**
 * The normalised side of a listing, eager-loaded on every read.
 *
 * Carried alongside the legacy string columns rather than instead of them:
 * the DTO now returns ids AND values, so a client can move to ids at its own
 * pace instead of every app having to change on the same deploy.
 */
const REFERENCE_INCLUDE = [
  { model: PetType, as: 'petTypeRef' },
  { model: PetAttributeOption, as: 'breedOption' },
  { model: PetListingColor, as: 'colorRefs', include: [{ model: PetAttributeOption, as: 'option' }] },
  {
    model: PetListingAttributeValue,
    as: 'attributeValues',
    include: [
      { model: PetAttribute, as: 'attribute' },
      { model: PetAttributeOption, as: 'option' },
    ],
  },
];

const PUBLIC_INCLUDE = [MEDIA_INCLUDE, STORE_INCLUDE, OWNER_INCLUDE, ...REFERENCE_INCLUDE];

/** Only place `pet_listings` / `pet_listing_media` are queried. */
export const petListingRepository = {
  /**
   * The partner's own list. Store-scoped, so there is no way to read another
   * kennel's listings through it.
   *
   * ARCHIVED (a removed listing — see Remove Listing on the detail screen)
   * is excluded unless the caller explicitly filters for it, the same way a
   * trash folder stays out of an inbox until opened on purpose. Any other
   * `status` filter is exact, same as before.
   */
  findAndCountForStore({ storeId, status, petType, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    else where.status = { [Op.ne]: 'ARCHIVED' };
    if (petType) where.petType = petType;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { breed: { [Op.like]: `%${search}%` } }];
    }

    return PetListing.findAndCountAll({
      where,
      include: [MEDIA_INCLUDE, ...REFERENCE_INCLUDE],
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
      limit,
      offset,
      // Without this, one listing with three photos counts as three.
      distinct: true,
    });
  },

  findByIdForStore({ id, storeId }) {
    return PetListing.findOne({ where: { id, storeId }, include: [MEDIA_INCLUDE], order: MEDIA_ORDER });
  },

  /**
   * The public catalogue. `statuses` is the caller's business — this never
   * assumes which are visible.
   *
   * `excludeOwnerId` drops the viewer's own listings. That is what keeps
   * the Adopt / Rehome feed from showing someone the pet they are trying
   * to rehome as though it were a pet they could take in.
   */
  async findAndCountPublic({
    statuses,
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
  }) {
    const where = { status: { [Op.in]: statuses } };
    if (listingType) where.listingType = listingType;
    if (individualOnly) where.individualOwnerId = { [Op.ne]: null };
    if (excludeOwnerId) {
      // `Op.ne` alone would also drop every partner listing, whose
      // individualOwnerId is NULL and so compares as unknown, not true.
      where[Op.and] = [
        ...(where[Op.and] ?? []),
        { [Op.or]: [{ individualOwnerId: null }, { individualOwnerId: { [Op.ne]: excludeOwnerId } }] },
      ];
    }
    /**
     * A listing is "in" a place if its own column says so (individuals) or
     * its store's does (partners) — the same either/or `locationOf` resolves
     * for the DTO, expressed in SQL so the filter and the label can never
     * disagree.
     *
     * `$store.x$` reaches into the joined table; `subQuery: false` below is
     * what makes that legal alongside a LIMIT.
     *
     * State is the wider net and the one the feed opens on; city narrows
     * within it. Both may be sent — a city inside a state simply intersects.
     *
     * The city arm of the state filter is not a nicety. A `state` column is
     * only as good as whoever filled it in, and plenty of rows never got
     * one: partner stores onboarded with a city alone, and listings created
     * before the app started sending a state alongside the city. Matching
     * "…or its city is one of the cities in that state" is what makes the
     * feed answer the question the user actually asked — *show me pets near
     * me* — instead of hiding a Bengaluru kennel from someone browsing
     * Karnataka because a column was blank. `citiesInState` reads the same
     * bundled dataset the location picker searches, so the two can't drift.
     */
    if (state) {
      const citiesInThisState = citiesInState(state);
      const inState = [{ state }, { '$store.state$': state }];
      if (citiesInThisState.length) {
        inState.push({ city: { [Op.in]: citiesInThisState } }, { '$store.city$': { [Op.in]: citiesInThisState } });
      }

      where[Op.and] = [...(where[Op.and] ?? []), { [Op.or]: inState }];
    }
    if (city) {
      where[Op.and] = [
        ...(where[Op.and] ?? []),
        { [Op.or]: [{ city }, { '$store.city$': city }] },
      ];
    }
    if (petType) where.petType = petType;
    if (breed) where.breed = breed;
    if (gender) where.gender = gender;
    if (size) where.size = size;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.priceInInr = {
        ...(minPrice !== undefined ? { [Op.gte]: minPrice } : {}),
        ...(maxPrice !== undefined ? { [Op.lte]: maxPrice } : {}),
      };
    }
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { breed: { [Op.like]: `%${search}%` } }];
    }

    /**
     * Paged in two steps: the ids on this page, then those ids in full.
     *
     * `findAndCountAll` cannot do this in one query here. `subQuery: false`
     * is mandatory for the `$store.state$` / `$store.city$` references
     * above to resolve — but it also drops the LIMIT into the flat joined
     * result set, and `PUBLIC_INCLUDE` carries four hasMany associations
     * (media, colours, attribute values and their options). One listing
     * with three photos and five answers is fifteen joined rows, so a
     * `limit: 20` page was returning **one or two pets out of thirteen**
     * while `count` correctly reported all thirteen — a catalogue that
     * looked empty the moment any filter was applied, and the reason
     * picking a city appeared to hide every pet in it.
     *
     * The id query joins only `store` (a belongsTo — one row per listing,
     * so LIMIT counts listings), and the hydrate query has no limit at all,
     * so its joins are free to fan out.
     */
    const scope = { where, include: [{ ...STORE_INCLUDE, attributes: [] }], subQuery: false };

    const [idRows, total] = await Promise.all([
      PetListing.findAll({
        ...scope,
        attributes: ['id'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        raw: true,
      }),
      PetListing.count({ ...scope, distinct: true, col: 'id' }),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) return { rows: [], count: total };

    const rows = await PetListing.findAll({
      where: { id: { [Op.in]: ids } },
      include: PUBLIC_INCLUDE,
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
    });

    return { rows, count: total };
  },

  /**
   * How many currently available pets each of these stores has, as a
   * `{ [storeId]: count }` map — one grouped query for a whole page of
   * store cards rather than one COUNT per card.
   *
   * Stores with zero live listings are simply absent from the result; the
   * caller defaults them to 0 (see storeCatalog.service's toPublicDto).
   */
  async countPublicByStoreIds({ storeIds, statuses }) {
    if (!storeIds.length) return {};

    const rows = await PetListing.findAll({
      where: { storeId: { [Op.in]: storeIds }, status: { [Op.in]: statuses } },
      attributes: ['storeId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['storeId'],
      raw: true,
    });

    return Object.fromEntries(rows.map((row) => [row.storeId, Number(row.count)]));
  },

  /**
   * Every publicly discoverable listing for one store — backs the store-details
   * page's own pet list.
   *
   * Includes the store even though the caller already knows which store it
   * asked about: these go through the same public DTO as every other
   * listing, and the app renders a seller badge from it. Without the
   * include, `store` comes back null and the card has no seller to show.
   */
  findPublicByStoreId({ storeId, statuses }) {
    return PetListing.findAll({
      where: { storeId, status: { [Op.in]: statuses } },
      include: PUBLIC_INCLUDE,
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
    });
  },

  /**
   * A specific set of public listings, for callers that already hold ids
   * — the wishlist, which stores ids and needs the listings behind them.
   *
   * Deliberately re-applies `statuses` rather than trusting the caller's
   * ids: an archived listing must not reappear. Sold and paused listings
   * are included by the public status set and render their status in the
   * app. Includes the store for the same reason findPublicByStoreId does.
   */
  findPublicByIds({ ids, statuses }) {
    if (ids.length === 0) return Promise.resolve([]);
    return PetListing.findAll({
      where: { id: { [Op.in]: ids }, status: { [Op.in]: statuses } },
      include: PUBLIC_INCLUDE,
      order: MEDIA_ORDER,
    });
  },

  /** One public listing, by id or slug — a shareable link uses the slug, an in-app tap uses the id. */
  findOnePublic({ idOrSlug, statuses }) {
    return PetListing.findOne({
      where: {
        status: { [Op.in]: statuses },
        [Op.or]: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: PUBLIC_INCLUDE,
      order: MEDIA_ORDER,
    });
  },

  findBySlug(slug, options) {
    return PetListing.findOne({ where: { slug }, ...options });
  },

  /**
   * A live listing this store already has under the same name.
   *
   * The comparison is the database's, which is case-insensitive under the
   * default collation — "Bruno" and "bruno" are the same pet to a buyer
   * scanning a list.
   *
   * `excludeId` is the edit flow's own: saving a listing without renaming it
   * must not collide with itself.
   */
  /** Scoped to whichever owner is publishing — a store, or an individual. */
  findLiveByName({ storeId, individualOwnerId, name, excludeId }, options) {
    return PetListing.findOne({
      where: {
        ...(storeId ? { storeId } : { individualOwnerId }),
        name,
        status: { [Op.ne]: 'ARCHIVED' },
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      ...options,
    });
  },

  /**
   * A customer's own listings — the "My Listings" screen. Owner-scoped, so
   * there is no way to read another person's listings through it, exactly
   * like findAndCountForStore.
   *
   * ARCHIVED is excluded unless asked for, same trash-folder reasoning.
   */
  findAndCountForOwner({ individualOwnerId, status, petType, search, limit, offset }) {
    const where = { individualOwnerId };
    if (status) where.status = status;
    else where.status = { [Op.ne]: 'ARCHIVED' };
    if (petType) where.petType = petType;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { breed: { [Op.like]: `%${search}%` } }];
    }

    return PetListing.findAndCountAll({
      where,
      include: [MEDIA_INCLUDE, ...REFERENCE_INCLUDE],
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
      limit,
      offset,
      distinct: true,
    });
  },

  findByIdForOwner({ id, individualOwnerId }) {
    return PetListing.findOne({
      where: { id, individualOwnerId },
      include: [MEDIA_INCLUDE, ...REFERENCE_INCLUDE],
      order: MEDIA_ORDER,
    });
  },

  create(payload, options) {
    return PetListing.create(payload, options);
  },

  createMedia(rows, options) {
    return PetListingMedia.bulkCreate(rows, options);
  },

  /** Column/attribute changes only — media is replaced wholesale via `deleteMediaForListing` + `createMedia`, not patched row by row. */
  update(listing, payload, options) {
    return listing.update(payload, options);
  },

  /** Wipes a listing's media rows so an edit can recreate them in the new order/main-photo choice, same as a fresh publish would. */
  deleteMediaForListing(petListingId, options) {
    return PetListingMedia.destroy({ where: { petListingId }, ...options });
  },

  /**
   * Bumps a listing's view counter.
   *
   * `increment` issues `SET view_count = view_count + 1` — the database does
   * the arithmetic, so two people opening the same listing at once can't
   * both read 41 and both write 42.
   */
  incrementViewCount(id) {
    return PetListing.increment('viewCount', { by: 1, where: { id } });
  },

  /**
   * Rewrites a listing's normalised choice rows to exactly what was
   * submitted.
   *
   * Replace rather than diff: the client always posts the complete set of
   * answers it wants the listing to have, the same way it posts the complete
   * media gallery, so there is nothing to reconcile and a diff would only be
   * a slower way to reach the same rows.
   */
  async replaceChoiceRows({ petListingId, colorOptionIds, attributeChoices }, options) {
    await PetListingColor.destroy({ where: { petListingId }, ...options });
    await PetListingAttributeValue.destroy({ where: { petListingId }, ...options });

    if (colorOptionIds.length > 0) {
      await PetListingColor.bulkCreate(
        colorOptionIds.map((optionId) => ({ petListingId, optionId })),
        options
      );
    }

    if (attributeChoices.length > 0) {
      await PetListingAttributeValue.bulkCreate(
        attributeChoices.map(({ attributeId, optionId }) => ({ petListingId, attributeId, optionId })),
        options
      );
    }
  },
};
