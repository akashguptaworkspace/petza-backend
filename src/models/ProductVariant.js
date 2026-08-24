import { DataTypes, Model } from 'sequelize';

/**
 * One buyable version of a product: "2 kg", "5 kg", "Large / Blue".
 *
 * This is where price and stock live — a product with a single size still
 * gets exactly one variant, so no screen or query has to special-case the
 * one-size shape.
 *
 * Stock is a column here rather than its own `inventory` table because a
 * Petza seller ships from one place. The day stores get warehouses, stock
 * moves to `inventory(variant_id, location_id, quantity)` and this column
 * becomes its sum — nothing else about the catalogue changes.
 */
export default (sequelize) => {
  class ProductVariant extends Model {
    static associate(db) {
      ProductVariant.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });
    }
  }

  ProductVariant.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** What the customer picks in the variant selector, e.g. "2 kg". */
      label: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      /** The seller's own code. Unique per store, not globally — two shops may legitimately use the same SKU. */
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Integers only — money is never a float (PLATFORM_CONTEXT.md §10/R8). */
      priceInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      /** List price, when the seller is showing a discount against it. Null means "no strike-through". */
      mrpInInr: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      stockQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      /** At or below this, the variant shows as low stock. Per-variant because a 20 kg sack and a chew toy don't restock alike. */
      lowStockThreshold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      /** Display order in the variant picker. */
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'ProductVariant',
      tableName: 'product_variants',
    }
  );

  return ProductVariant;
};
