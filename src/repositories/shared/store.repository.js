import { Op } from 'sequelize';

import db from '../../models/index.js';

const { GroomerProfile, KennelProfile, Store, StoreKycDocument, SupplierProfile, TrainerProfile, VetProfile } = db;

/**
 * Every per-business-type profile, eager-loaded together. A store only
 * ever has one (its `businessType` decides which), so four of the five are
 * always null — cheaper than branching the query per type, and it lets the
 * public DTO read whichever one exists without a second round trip.
 */
const PROFILE_INCLUDE = [
  { model: KennelProfile, as: 'kennelProfile' },
  { model: VetProfile, as: 'vetProfile' },
  { model: TrainerProfile, as: 'trainerProfile' },
  { model: GroomerProfile, as: 'groomerProfile' },
  { model: SupplierProfile, as: 'supplierProfile' },
];

/** Per-business-type profile model, keyed by `stores.business_type`. */
const PROFILE_MODEL = {
  KENNEL: KennelProfile,
  VET: VetProfile,
  TRAINER: TrainerProfile,
  GROOMER: GroomerProfile,
  SUPPLIER: SupplierProfile,
};

const PROFILE_ALIAS = {
  KENNEL: 'kennelProfile',
  VET: 'vetProfile',
  TRAINER: 'trainerProfile',
  GROOMER: 'groomerProfile',
  SUPPLIER: 'supplierProfile',
};

/** Only place `stores` (and its profile/document tables) are queried — services never touch the models directly. */
export const storeRepository = {
  findById(id, options) {
    return Store.findByPk(id, options);
  },

  findByOwnerUserId(ownerUserId, options) {
    return Store.findOne({ where: { ownerUserId }, ...options });
  },

  /** The full onboarding view: store + its KYC documents + whichever single profile its business type points at. */
  findByOwnerUserIdWithProfile(ownerUserId) {
    return Store.findOne({
      where: { ownerUserId },
      include: [
        { model: StoreKycDocument, as: 'kycDocuments' },
        { model: KennelProfile, as: 'kennelProfile' },
        { model: VetProfile, as: 'vetProfile' },
        { model: TrainerProfile, as: 'trainerProfile' },
        { model: GroomerProfile, as: 'groomerProfile' },
        { model: SupplierProfile, as: 'supplierProfile' },
      ],
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
   * picking a business type and submitting KYC, and a nameless card is not
   * something a customer can act on.
   */
  findAndCountPublic({ statuses, search, city, businessType, capability, limit, offset }) {
    const where = {
      status: { [Op.in]: statuses },
      name: { [Op.ne]: null },
    };
    if (city) where.city = city;
    if (businessType) where.businessType = businessType;
    /**
     * `capabilities` is a MySQL SET, so membership is `FIND_IN_SET`, not a
     * LIKE — a LIKE on the comma-joined text would match SELL_PETS inside
     * a hypothetical SELL_PETS_WHOLESALE. The value is bound as a
     * replacement rather than interpolated, and the validator has already
     * constrained it to the known enum.
     */
    if (capability) {
      where[Op.and] = [Store.sequelize.literal('FIND_IN_SET(:capability, `Store`.`capabilities`)')];
    }
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { city: { [Op.like]: `%${search}%` } }];
    }

    return Store.findAndCountAll({
      where,
      include: PROFILE_INCLUDE,
      ...(capability ? { replacements: { capability } } : {}),
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
      include: PROFILE_INCLUDE,
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
      include: PROFILE_INCLUDE,
    });
  },

  create(payload, options) {
    return Store.create(payload, options);
  },

  update(store, payload, options) {
    return store.update(payload, options);
  },

  /**
   * Replaces the profile row for a business type — an upsert by store, not
   * by primary key, so resubmitting KYC updates in place instead of piling
   * up rows behind the profile's unique store_id.
   */
  async upsertProfile({ businessType, storeId, values, transaction }) {
    const Model = PROFILE_MODEL[businessType];
    const existing = await Model.findOne({ where: { storeId }, transaction });
    if (existing) return existing.update(values, { transaction });
    return Model.create({ ...values, storeId }, { transaction });
  },

  /** Used when a partner switches business type before KYC — the old type's answers no longer apply to the new one. */
  async deleteProfilesExcept({ businessType, storeId, transaction }) {
    const stale = Object.entries(PROFILE_MODEL).filter(([type]) => type !== businessType);
    await Promise.all(stale.map(([, Model]) => Model.destroy({ where: { storeId }, transaction })));
  },

  profileAliasFor(businessType) {
    return PROFILE_ALIAS[businessType];
  },

  /** KYC documents are replaced wholesale on each submit — the app always posts the complete list it is showing. */
  async replaceKycDocuments({ storeId, documents, transaction }) {
    await StoreKycDocument.destroy({ where: { storeId }, transaction });
    if (!documents.length) return [];
    return StoreKycDocument.bulkCreate(
      documents.map((document) => ({ storeId, name: document.name, fileUrl: document.uri })),
      { transaction }
    );
  },
};
