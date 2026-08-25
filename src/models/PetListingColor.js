import { DataTypes, Model } from 'sequelize';

/**
 * One colour on a listing, as a reference to the option it came from.
 *
 * A join table rather than the JSON array it replaces: colours are many per
 * listing, an admin renaming "Grey" must not have to rewrite every
 * document, and a `WHERE option_id = ?` on an indexed column is something
 * the JSON array could never be filtered by.
 */
export default (sequelize) => {
  class PetListingColor extends Model {
    static associate(db) {
      PetListingColor.belongsTo(db.PetListing, { as: 'listing', foreignKey: 'petListingId' });
      PetListingColor.belongsTo(db.PetAttributeOption, { as: 'option', foreignKey: 'optionId' });
    }
  }

  PetListingColor.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      petListingId: { type: DataTypes.UUID, allowNull: false },
      optionId: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, modelName: 'PetListingColor', tableName: 'pet_listing_colors' }
  );

  return PetListingColor;
};
