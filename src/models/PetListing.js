import { DataTypes, Model } from 'sequelize';

import { PetListingStatus, PetListingType } from '../config/constants.js';

/**
 * A pet listed for sale or rehoming — by a partner store, or by a customer
 * listing their own pet.
 *
 * See the create-pet-listings migration for why the filtered fields are
 * columns while the rest of the dynamic form's answers live in
 * `attributes`.
 */
export default (sequelize) => {
  class PetListing extends Model {
    static associate(db) {
      // Normalised references. The legacy `petType` / `breed` / `colors` /
      // `attributes` columns are still written and still read by both apps;
      // these are what an admin panel edits against.
      PetListing.belongsTo(db.PetType, { as: 'petTypeRef', foreignKey: 'petTypeId' });
      PetListing.belongsTo(db.PetAttributeOption, { as: 'breedOption', foreignKey: 'breedOptionId' });
      PetListing.hasMany(db.PetListingColor, { as: 'colorRefs', foreignKey: 'petListingId' });
      PetListing.hasMany(db.PetListingAttributeValue, { as: 'attributeValues', foreignKey: 'petListingId' });
      PetListing.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      PetListing.belongsTo(db.User, { as: 'individualOwner', foreignKey: 'individualOwnerId' });
      PetListing.hasMany(db.PetListingMedia, { as: 'media', foreignKey: 'petListingId' });
    }
  }

  PetListing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /**
       * Never taken from a request body — always `req.store.id`. Null when
       * a customer listed the pet themselves; see `individualOwnerId`.
       * Exactly one of the two is set (enforced in petListing.service).
       */
      storeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /** Never taken from a request body — always `req.user.id`. Null for a partner store listing. */
      individualOwnerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      listingType: {
        type: DataTypes.ENUM(...Object.values(PetListingType)),
        allowNull: false,
        defaultValue: PetListingType.SALE,
      },
      petType: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
      },
      breed: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      /** Only set when `breed` is the "Other" sentinel. */
      breedOther: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      size: {
        type: DataTypes.STRING(24),
        allowNull: true,
      },
      colors: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      /** Denormalised at write time so listing queries don't recompute it per row. */
      ageLabel: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      weightKg: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** Null on an ADOPTION listing — a rehomed pet has no price. */
      priceInInr: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      priceType: {
        type: DataTypes.STRING(24),
        allowNull: true,
      },
      /**
       * Where the pet is. Captured from the lister's own location when they
       * publish — the add-pet form never asks. Null on a partner listing,
       * which inherits its store's instead (see `locationOf`).
       */
      city: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(12),
        allowNull: true,
      },
      /** Recorded for future distance sorting; nothing reads them yet. */
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      petTypeId: { type: DataTypes.UUID, allowNull: true },
      breedOptionId: { type: DataTypes.UUID, allowNull: true },
      /** How many times the public detail page has been opened by someone other than the owner. */
      viewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(PetListingStatus)),
        allowNull: false,
        defaultValue: PetListingStatus.AVAILABLE,
      },
      /** Everything else the dynamic form collected, keyed by `pet_attributes.key`. */
      attributes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'PetListing',
      tableName: 'pet_listings',
    }
  );

  return PetListing;
};
