import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Category, ProductListing, ServiceAvailability, ServiceListing } = db;

/** A listing card always shows what it is filed under, so the category comes along on every read. */
const CATEGORY_INCLUDE = [
  { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'requiresVerification'] },
];

const PRODUCT_INCLUDE = [
  ...CATEGORY_INCLUDE,
  { model: Category, as: 'tag', attributes: ['id', 'name', 'slug', 'requiresVerification'] },
];

const AVAILABILITY_INCLUDE = {
  model: ServiceAvailability,
  as: 'availability',
  separate: true,
  order: [
    ['dayOfWeek', 'ASC'],
    ['startTime', 'ASC'],
  ],
};

/**
 * Both listing tables, read and write. Services never touch the models
 * directly.
 *
 * The two halves are deliberately near-identical rather than abstracted
 * into one generic helper: the shapes diverge (a product has stock and a
 * tag, a service has availability rows), and a shared "listing" abstraction
 * would spend most of its body branching on which one it actually had.
 */
export const listingRepository = {
  // ---------------------------------------------------------------- products

  /** The Listings tab, products half. `status` is the filter chip; omitted means All. */
  findAndCountProducts({ storeId, status, tagId, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    if (tagId) where.tagId = tagId;
    if (search) where.name = { [Op.like]: `%${search}%` };

    return ProductListing.findAndCountAll({
      where,
      include: PRODUCT_INCLUDE,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
  },

  /**
   * One product, scoped to its store.
   *
   * `storeId` is part of the lookup rather than checked afterwards, so a
   * partner guessing another partner's listing id gets a plain 404 and
   * learns nothing about whether it exists.
   */
  findProductById({ id, storeId }) {
    return ProductListing.findOne({ where: { id, storeId }, include: PRODUCT_INCLUDE });
  },

  createProduct(payload, options) {
    return ProductListing.create(payload, options);
  },

  /** Counts per status, for the dashboard tiles and the filter chips — one grouped query rather than one per chip. */
  async countProductsByStatus(storeId) {
    const rows = await ProductListing.findAll({
      where: { storeId },
      attributes: ['status', [ProductListing.sequelize.fn('COUNT', '*'), 'count']],
      group: ['status'],
      raw: true,
    });
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  },

  // ---------------------------------------------------------------- services

  findAndCountServices({ storeId, status, categoryId, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (search) where.name = { [Op.like]: `%${search}%` };

    return ServiceListing.findAndCountAll({
      where,
      include: CATEGORY_INCLUDE,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
  },

  findServiceById({ id, storeId }) {
    return ServiceListing.findOne({
      where: { id, storeId },
      include: [...CATEGORY_INCLUDE, AVAILABILITY_INCLUDE],
    });
  },

  createService(payload, options) {
    return ServiceListing.create(payload, options);
  },

  async countServicesByStatus(storeId) {
    const rows = await ServiceListing.findAll({
      where: { storeId },
      attributes: ['status', [ServiceListing.sequelize.fn('COUNT', '*'), 'count']],
      group: ['status'],
      raw: true,
    });
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  },

  /**
   * Availability is replaced wholesale, never patched row by row: the
   * app's availability step always posts the complete weekly grid it is
   * showing, so diffing it here would be reconstructing what the client
   * already knows.
   */
  async replaceAvailability({ serviceListingId, slots, transaction }) {
    await ServiceAvailability.destroy({ where: { serviceListingId }, transaction });
    if (!slots.length) return [];
    return ServiceAvailability.bulkCreate(
      slots.map((slot) => ({
        serviceListingId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxBookingsPerSlot: slot.maxBookingsPerSlot ?? 1,
      })),
      { transaction }
    );
  },

  // ------------------------------------------------------------------ shared

  /** Both listing kinds update in place through their instance, so one helper serves either. */
  update(listing, payload, options) {
    return listing.update(payload, options);
  },

  destroy(listing, options) {
    return listing.destroy(options);
  },
};
