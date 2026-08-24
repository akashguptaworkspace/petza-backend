import { Op } from 'sequelize';

import db from '../../models/index.js';

const { PetListing, PetListingMedia, Store } = db;

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
  attributes: ['id', 'name', 'slug', 'city', 'isVerified'],
};

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
      include: [MEDIA_INCLUDE],
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

  /** The public catalogue. `statuses` is the caller's business — this never assumes which are visible. */
  findAndCountPublic({ statuses, petType, breed, gender, size, minPrice, maxPrice, search, limit, offset }) {
    const where = { status: { [Op.in]: statuses } };
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

    return PetListing.findAndCountAll({
      where,
      include: [MEDIA_INCLUDE, STORE_INCLUDE],
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
      limit,
      offset,
      distinct: true,
    });
  },

  /**
   * How many publicly-buyable pets each of these stores has, as a
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
   * Every publicly-buyable listing for one store — backs the store-details
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
      include: [MEDIA_INCLUDE, STORE_INCLUDE],
      order: [['createdAt', 'DESC'], ...MEDIA_ORDER],
    });
  },

  /** One public listing, by id or slug — a shareable link uses the slug, an in-app tap uses the id. */
  findOnePublic({ idOrSlug, statuses }) {
    return PetListing.findOne({
      where: {
        status: { [Op.in]: statuses },
        [Op.or]: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: [MEDIA_INCLUDE, STORE_INCLUDE],
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
  findLiveByName({ storeId, name, excludeId }, options) {
    return PetListing.findOne({
      where: {
        storeId,
        name,
        status: { [Op.ne]: 'ARCHIVED' },
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      ...options,
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
};
