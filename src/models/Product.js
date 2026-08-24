import { DataTypes, Model } from 'sequelize';

import { ProductStatus } from '../config/constants.js';

/**
 * A supplies catalogue entry — food, toys, accessories, grooming kit.
 *
 * Deliberately its own table rather than another `pet_listings` row: a
 * product has **variants** (pack sizes with their own price and stock), is
 * bought in **quantity > 1**, and carries a **brand** that is not the
 * seller (see PLATFORM_CONTEXT.md §2.4). A pet listing has none of those,
 * and forcing both through one table would give each a pile of columns the
 * other can never fill.
 *
 * Price and stock live on `product_variants`, never here — even a product
 * sold in one size is one variant, so nothing has to special-case the
 * single-variant shape.
 */
export default (sequelize) => {
  class Product extends Model {
    static associate(db) {
      Product.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      Product.hasMany(db.ProductVariant, { as: 'variants', foreignKey: 'productId' });
    }
  }

  Product.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /** Never taken from a request body — always `req.user.partnerStoreId`. */
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
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
      /** The manufacturer, which is not the seller — the customer app's brand facet reads this while the seller is `storeId`. */
      brand: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Catalogue category slug, e.g. "dry-food", "toys", "grooming". */
      categorySlug: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      /** Which animals it is for, e.g. ["dogs","cats"] — a supplies filter, not a pet record. */
      petTypes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** Until the media pipeline lands this holds whatever URL the app has. */
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /**
       * DRAFT is the partner's own workspace, ACTIVE is visible to
       * customers, ARCHIVED is retired but kept — products are never
       * deleted, because past orders point at them.
       */
      status: {
        type: DataTypes.ENUM(...Object.values(ProductStatus)),
        allowNull: false,
        defaultValue: ProductStatus.DRAFT,
      },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',
    }
  );

  return Product;
};
