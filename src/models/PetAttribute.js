import { DataTypes, Model } from 'sequelize';

import { PetAttributeInputType, PetAttributeSection } from '../config/constants.js';

/**
 * One question on the add-pet form.
 *
 * `petType: null` means every listing is asked it; a value scopes it to
 * that animal, which is what makes the CATEGORY section differ between a
 * dog and a cat. See the create-pet-attributes migration for why the form
 * is data rather than columns.
 */
export default (sequelize) => {
  class PetAttribute extends Model {
    static associate(db) {
      PetAttribute.belongsTo(db.PetType, { as: 'petTypeRef', foreignKey: 'petTypeId' });
      PetAttribute.hasMany(db.PetAttributeOption, { as: 'options', foreignKey: 'attributeId' });
    }
  }

  PetAttribute.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /** STRING, not ENUM — a new pet type should be a seed change, not an ALTER TABLE. */
      petTypeId: { type: DataTypes.UUID, allowNull: true },
      petType: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      section: {
        type: DataTypes.ENUM(...Object.values(PetAttributeSection)),
        allowNull: false,
      },
      /** The stable identifier a stored answer refers to. */
      key: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      inputType: {
        type: DataTypes.ENUM(...Object.values(PetAttributeInputType)),
        allowNull: false,
      },
      isRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Derived and shown read-only, e.g. age from date of birth. */
      isReadOnly: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Picking "Other" reveals a free-text box — keeps a curated list from blocking an unusual answer. */
      allowsOther: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      placeholder: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      helpText: {
        type: DataTypes.STRING(240),
        allowNull: true,
      },
      /** Hidden until the field named here holds one of `dependsOnValues`. Compared as strings, so a BOOLEAN parent uses ['true']. */
      dependsOnKey: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      dependsOnValues: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      /** How many files a FILE/MEDIA field accepts. Null for every other input type. */
      maxItems: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** Presentation hint — 'INR' groups a number as currency while typing. Never affects what is stored. */
      format: {
        type: DataTypes.STRING(24),
        allowNull: true,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'PetAttribute',
      tableName: 'pet_attributes',
    }
  );

  return PetAttribute;
};
