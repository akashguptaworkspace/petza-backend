import { DataTypes, Model } from 'sequelize';

import { PetMediaType } from '../config/constants.js';

/** One photo or clip on a listing. Exactly one row per listing carries `isMain` — the image every card renders. */
export default (sequelize) => {
  class PetListingMedia extends Model {
    static associate(db) {
      PetListingMedia.belongsTo(db.PetListing, { as: 'listing', foreignKey: 'petListingId' });
    }
  }

  PetListingMedia.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      petListingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** Server-relative (`/uploads/pets/…`), resolved against the API host by whichever app renders it. */
      url: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(PetMediaType)),
        allowNull: false,
      },
      isMain: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'PetListingMedia',
      tableName: 'pet_listing_media',
    }
  );

  return PetListingMedia;
};
