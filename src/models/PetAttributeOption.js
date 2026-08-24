import { DataTypes, Model } from 'sequelize';

/**
 * One choice on a SELECT or MULTI_SELECT pet attribute — a breed, a coat
 * type, a temperament trait.
 *
 * `value` is what ends up stored on a listing and never changes; `label`
 * is display text and is free to be reworded, so fixing a typo in "Labrador
 * Retreiver" doesn't orphan every dog already listed under it.
 */
export default (sequelize) => {
  class PetAttributeOption extends Model {
    static associate(db) {
      PetAttributeOption.belongsTo(db.PetAttribute, { as: 'attribute', foreignKey: 'attributeId' });
    }
  }

  PetAttributeOption.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      attributeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      value: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'PetAttributeOption',
      tableName: 'pet_attribute_options',
    }
  );

  return PetAttributeOption;
};
