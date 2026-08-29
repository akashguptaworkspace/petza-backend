import { DataTypes, Model } from 'sequelize';

/**
 * One line on an order.
 *
 * `productName`, `productImageUrl` and `priceAtPurchaseInInr` are
 * snapshots, not joins. The partner is free to rename, re-photograph or
 * reprice a listing afterwards, and a months-old order still has to render
 * what was actually bought and what was actually charged. The foreign key
 * stays so the listing is still reachable — it just isn't the source of
 * truth for how this line reads.
 */
export default (sequelize) => {
  class OrderItem extends Model {
    static associate(db) {
      OrderItem.belongsTo(db.Order, { as: 'order', foreignKey: 'orderId' });
      OrderItem.belongsTo(db.ProductListing, { as: 'productListing', foreignKey: 'productListingId' });
    }

    get lineTotalInInr() {
      return this.priceAtPurchaseInInr * this.quantity;
    }
  }

  OrderItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      productListingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      productImageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      priceAtPurchaseInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'OrderItem',
      tableName: 'order_items',
    }
  );

  return OrderItem;
};
