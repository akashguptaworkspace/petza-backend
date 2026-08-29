import { DataTypes, Model } from 'sequelize';

import { CategoryAttributeType } from '../config/constants.js';

/**
 * One dynamic form field on the add-listing wizard. Selecting a category
 * or tag is what pulls its rows in (PRODUCT_CONTEXT.md §7), and the
 * answers land in the listing's `attributes` JSON keyed by
 * `attributeKey`.
 *
 * The server sends the *kind* of answer it wants, never a component name,
 * so the app maps each type onto its own form primitive and the two can
 * change independently.
 */
export default (sequelize) => {
  class CategoryAttribute extends Model {
    static associate(db) {
      CategoryAttribute.belongsTo(db.Category, { as: 'category', foreignKey: 'categoryId' });
    }
  }

  CategoryAttribute.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /**
       * The stable key the answer is stored under. Separate from
       * `attributeName` so a label can be reworded without orphaning every
       * answer already saved against it.
       */
      attributeKey: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      /** The human label rendered above the field. */
      attributeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attributeType: {
        type: DataTypes.ENUM(...Object.values(CategoryAttributeType)),
        allowNull: false,
      },
      /** `[{ value, label }]` for SELECT/MULTISELECT; null for every other type. */
      options: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      /** Placeholder or helper copy, so the form needs no per-field code in the app. */
      hint: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Rendered after the input — "kg", "ml", "months". */
      unit: {
        type: DataTypes.STRING(24),
        allowNull: true,
      },
      isRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'CategoryAttribute',
      tableName: 'category_attributes',
    }
  );

  return CategoryAttribute;
};
