import { DataTypes, Model } from 'sequelize';

/**
 * The KENNEL half of a store's KYC — one row per store, only for stores
 * whose `businessType` is KENNEL. Kept out of `stores` (rather than as a
 * pile of nullable columns there) because every business type asks for a
 * different set of proofs, and a vet's store row should never carry a
 * `registration_number` column it can never fill.
 *
 * Also covers pet shops: they and breeders are one business type on Petza
 * (see config/constants.js), so both land here.
 */
export default (sequelize) => {
  class KennelProfile extends Model {
    static associate(db) {
      KennelProfile.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  KennelProfile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      yearsActive: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** Kennel Club of India (or equivalent) registration — verified by Petza staff, not by us. */
      registrationNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      /** Breed slugs the kennel deals in, e.g. ["golden-retriever","labrador"]. A join table only earns its keep once we filter/sort on breeds. */
      breeds: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'KennelProfile',
      tableName: 'kennel_profiles',
    }
  );

  return KennelProfile;
};
