import { DataTypes, Model } from 'sequelize';

/** The GROOMER half of a store's KYC — see KennelProfile.js for why these live in per-business-type tables. */
export default (sequelize) => {
  class GroomerProfile extends Model {
    static associate(db) {
      GroomerProfile.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  GroomerProfile.init(
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
      experienceYears: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** A salon works out of one address; a mobile groomer travels to the pet. It changes what the customer app has to show, so it is a column rather than a note. */
      isMobile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Grooming service slugs, e.g. ["full-groom","bath-brush","nail-trim"]. */
      services: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      /** Which animals they take — a cat groom is a different skill (and a different price) from a dog groom. */
      petTypes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'GroomerProfile',
      tableName: 'groomer_profiles',
    }
  );

  return GroomerProfile;
};
