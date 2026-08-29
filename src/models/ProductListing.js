import { DataTypes, Model } from 'sequelize';

import { ModerationStatus, ProductListingStatus } from '../config/constants.js';

/**
 * One pet-supplies product, fully partner-authored — there is no master
 * catalogue to match against (PRODUCT_CONTEXT.md §7).
 *
 * Flat, with no variant rows: the shape it replaced carried pack sizes
 * each with their own price and stock, which meant every screen had to
 * decide which variant it was talking about. A partner selling three pack
 * sizes now creates three listings, and the dynamic `attributes` carry
 * whatever the tag needs to distinguish them.
 *
 * Live to customers only when `status === ACTIVE` **and**
 * `moderationStatus === APPROVED` (§8) — see `isPubliclyVisible`.
 */
export default (sequelize) => {
  class ProductListing extends Model {
    static associate(db) {
      ProductListing.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      ProductListing.belongsTo(db.Category, { as: 'category', foreignKey: 'categoryId' });
      ProductListing.belongsTo(db.Category, { as: 'tag', foreignKey: 'tagId' });
      ProductListing.hasMany(db.OrderItem, { as: 'orderItems', foreignKey: 'productListingId' });
    }

    /** The two-part publish gate, in one place so no caller re-derives half of it. */
    get isPubliclyVisible() {
      return this.status === ProductListingStatus.ACTIVE && this.moderationStatus === ModerationStatus.APPROVED;
    }
  }

  ProductListing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** Always the "Accessories" root today — a column rather than a constant so a second product root needs no migration. */
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** The subcategory tag. What drives the dynamic fields and the shopper's filters. */
      tagId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** Whole rupees. Every price column in this schema is an INTEGER — never a float. */
      priceInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      /** The struck-through "was" price. Null when the partner isn't running one. */
      mrpInInr: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      stockQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Array of URLs; the first is the cover. */
      images: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      /** Answers to this tag's `category_attributes`, keyed by `attributeKey`. */
      attributes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: DataTypes.ENUM(...Object.values(ProductListingStatus)),
        allowNull: false,
        defaultValue: ProductListingStatus.DRAFT,
      },
      moderationStatus: {
        type: DataTypes.ENUM(...Object.values(ModerationStatus)),
        allowNull: false,
        defaultValue: ModerationStatus.PENDING,
      },
      /** Shown to the partner verbatim when a listing comes back rejected. */
      moderationNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      moderatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      moderatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProductListing',
      tableName: 'product_listings',
    }
  );

  return ProductListing;
};
