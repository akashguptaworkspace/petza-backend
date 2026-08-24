import { DataTypes, Model } from 'sequelize';

/** The VET half of a store's KYC — see KennelProfile.js for why these live in per-business-type tables. */
export default (sequelize) => {
  class VetProfile extends Model {
    static associate(db) {
      VetProfile.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  VetProfile.init(
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
      /** State/Indian Veterinary Council registration — the licence check that gates a vet going live. */
      councilRegistrationNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Service slugs offered, e.g. ["consultation","vaccination"]. Becomes real `offerings` rows (with prices/slots) in the care phase; this is only what they declared at KYC. */
      services: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'VetProfile',
      tableName: 'vet_profiles',
    }
  );

  return VetProfile;
};
