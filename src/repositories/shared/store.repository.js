import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Store, StoreKycDocument } = db;

/**
 * Only place `stores` (and its KYC document table) is queried — services
 * never touch the models directly.
 *
 * The five per-business-type profile tables this used to eager-load are
 * gone (migration 20260829000001). They existed to feed three separate
 * dashboards keyed by business type; there is one partner dashboard now,
 * and what varies inside it is `offersProducts`/`offersServices`. Anything
 * a profile row used to hold that is genuinely per-listing now lives in a
 * listing's dynamic `attributes` instead, where admin can add to it
 * without a migration.
 */
export const storeRepository = {
  findById(id, options) {
    return Store.findByPk(id, options);
  },

  findByOwnerUserId(ownerUserId, options) {
    return Store.findOne({ where: { ownerUserId }, ...options });
  },

  /** The full onboarding view: the store plus the documents staff review it on. */
  findByOwnerUserIdWithDocuments(ownerUserId) {
    return Store.findOne({
      where: { ownerUserId },
      include: [{ model: StoreKycDocument, as: 'kycDocuments' }],
    });
  },

  findBySlug(slug, options) {
    return Store.findOne({ where: { slug }, ...options });
  },

  /**
   * The public store directory — what petza-app's Stores tab lists.
   *
   * `statuses` is passed in rather than hardcoded here for the same reason
   * the pet catalogue does it (see petListing.repository's
   * findAndCountPublic): the repository answers "which rows", the service
   * decides "which are public".
   *
   * A store with no name is skipped: `stores.name` stays null between
   * signing up and submitting KYC, and a nameless card is not something a
   * customer can act on.
   */
  findAndCountPublic({ statuses, search, city, businessType, capability, limit, offset }) {
    const where = {
      status: { [Op.in]: statuses },
      name: { [Op.ne]: null },
    };
    if (city) where.city = city;
    if (businessType) where.businessType = businessType;
    /**
     * Filtering by what a store offers is now two plain booleans rather
     * than `FIND_IN_SET` over a MySQL SET — the capability set became two
     * columns in 20260829000001.
     */
    if (capability === 'PRODUCTS') where.offersProducts = true;
    if (capability === 'SERVICES') where.offersServices = true;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { city: { [Op.like]: `%${search}%` } }];
    }

    return Store.findAndCountAll({
      where,
      // Verified partners first, then newest — an unvetted-but-active store
      // shouldn't outrank a verified one just by being created later.
      order: [
        ['isVerified', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
      distinct: true,
    });
  },

  /**
   * A specific set of public stores, for callers that already hold ids —
   * the wishlist, which stores ids and needs the stores behind them.
   *
   * Re-applies `statuses` and the named-store rule for the same reason
   * findPublicByIds does on pet listings: a store saved while ACTIVE that
   * has since been suspended must drop out of the wishlist, not come back
   * as a card leading to a 404.
   */
  findPublicByIds({ ids, statuses }) {
    if (ids.length === 0) return Promise.resolve([]);
    return Store.findAll({
      where: {
        id: { [Op.in]: ids },
        status: { [Op.in]: statuses },
        name: { [Op.ne]: null },
      },
    });
  },

  /** One public store, by id or slug — a shared link uses the slug, an in-app tap uses the id. */
  findOnePublic({ idOrSlug, statuses }) {
    return Store.findOne({
      where: {
        status: { [Op.in]: statuses },
        name: { [Op.ne]: null },
        [Op.or]: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  },

  create(payload, options) {
    return Store.create(payload, options);
  },

  update(store, payload, options) {
    return store.update(payload, options);
  },

  /** KYC documents are replaced wholesale on each submit — the app always posts the complete list it is showing. */
  async replaceKycDocuments({ storeId, documents, transaction }) {
    await StoreKycDocument.destroy({ where: { storeId }, transaction });
    if (!documents.length) return [];
    return StoreKycDocument.bulkCreate(
      documents.map((document) => ({
        storeId,
        name: document.name,
        fileUrl: document.uri,
        docType: document.docType ?? 'OTHER',
      })),
      { transaction }
    );
  },
};
