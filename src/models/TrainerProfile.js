import { DataTypes, Model } from 'sequelize';

/** The TRAINER half of a store's KYC — see KennelProfile.js for why these live in per-business-type tables. */
export default (sequelize) => {
  class TrainerProfile extends Model {
    static associate(db) {
      TrainerProfile.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }
  }

  TrainerProfile.init(
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
      /** Certifying body slug (ccpdt/kpa/iaabc/other) — a free-text body name would make "show me certified trainers" unanswerable. */
      certificationBody: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      certificationNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Trainers travel to the client, so their catchment is an area + radius rather than the single address a clinic or kennel has. */
      baseArea: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      travelRadiusKm: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** Program slugs offered, e.g. ["puppy-basics","leash-manners"]. */
      trainingOffered: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'TrainerProfile',
      tableName: 'trainer_profiles',
    }
  );

  return TrainerProfile;
};
