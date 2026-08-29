import { DataTypes, Model } from 'sequelize';

import { ListingType } from '../config/constants.js';

/**
 * The taxonomy partners select from — admin-owned, never partner-authored
 * (PRODUCT_CONTEXT.md §4).
 *
 * One table, two shapes, split by `listingType`:
 *
 *   PRODUCT — a single root, "Accessories", whose children are the
 *             subcategory *tags* (Food, Toys, Hygiene…). The tags are not
 *             a browsable tree; they exist to key the dynamic form fields
 *             and to filter search.
 *   SERVICE — seven flat roots, no children, because each one has a
 *             materially different booking form.
 *
 * Nothing in the app hardcodes a member of either set (§10) — adding a tag
 * is an INSERT, not a release.
 */
export default (sequelize) => {
  class Category extends Model {
    static associate(db) {
      Category.belongsTo(db.Category, { as: 'parent', foreignKey: 'parentId' });
      Category.hasMany(db.Category, { as: 'children', foreignKey: 'parentId' });
      Category.hasMany(db.CategoryAttribute, { as: 'attributes', foreignKey: 'categoryId' });
    }
  }

  Category.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      listingType: {
        type: DataTypes.ENUM(...Object.values(ListingType)),
        allowNull: false,
      },
      /** Null for a top-level category; set for a product tag hanging off Accessories. */
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /** Names an icon in the app's own set, never a component — the two restyle independently. */
      iconKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /**
       * Gates listing under this category behind an approved KYC document.
       * True for Medicines, Supplements & vitamins, and Veterinary (§4).
       */
      requiresVerification: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Admin retires a category by clearing this — never by deleting, which would orphan every listing under it. */
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'Category',
      tableName: 'categories',
    }
  );

  return Category;
};
