import { DataTypes, Model } from 'sequelize';

/**
 * One choice on a SELECT or MULTI_SELECT pet attribute — a breed, a coat
 * type, a temperament trait.
 *
 * `value` is what ends up stored on a listing and never changes; `label`
 * is display text and is free to be reworded, so fixing a typo in "Labrador
 * Retreiver" doesn't orphan every dog already listed under it.
 *
 * That was always the intent and is now enforced: `UNIQUE(attribute_id,
 * value)` makes the value a key an admin panel can rely on, and the listing
 * write path rejects any choice that isn't in this table.
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
      /**
       * Whether the form still offers this choice.
       *
       * Retiring a breed sets this false rather than deleting the row —
       * deletion orphans every listing already published under it, while
       * this stops it being offered and leaves those listings resolving
       * their label exactly as before. Validation on write still accepts a
       * retired value, so editing such a listing doesn't fail on a field
       * its owner never touched.
       */
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
