import { DataTypes, Model } from 'sequelize';

import { PetListingStatus } from '../config/constants.js';

/**
 * A pet a kennel has listed for sale.
 *
 * See the create-pet-listings migration for why the filtered fields are
 * columns while the rest of the dynamic form's answers live in
 * `attributes`.
 */
export default (sequelize) => {
  class PetListing extends Model {
    static associate(db) {
      PetListing.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
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
      /** Never taken from a request body — always `req.store.id`. */
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
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
      priceInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      priceType: {
        type: DataTypes.STRING(24),
        allowNull: true,
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
