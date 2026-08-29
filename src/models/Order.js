import { DataTypes, Model } from 'sequelize';

import { OrderStatus, OrderStatusTransitions } from '../config/constants.js';

/**
 * A customer's purchase of one or more product listings from one store
 * (PRODUCT_CONTEXT.md §5, §7).
 *
 * One order per store by construction: a customer basket spanning two
 * partners becomes two orders, because each partner packs, ships and gets
 * paid for their own. That is why `storeId` is not nullable and why there
 * is no parent "cart" row here.
 */
export default (sequelize) => {
  class Order extends Model {
    static associate(db) {
      Order.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      Order.belongsTo(db.User, { as: 'customer', foreignKey: 'customerUserId' });
      Order.hasMany(db.OrderItem, { as: 'items', foreignKey: 'orderId' });
    }

    /** Where this order may go next. Empty for a terminal status, which is also how the UI decides to hide the status sheet. */
    get allowedNextStatuses() {
      return OrderStatusTransitions[this.status] ?? [];
    }
  }

  Order.init(
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
      customerUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** The short reference both sides quote in chat — "PTZ-4821". A UUID is unusable for that. */
      orderNumber: {
        type: DataTypes.STRING(24),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(OrderStatus)),
        allowNull: false,
        defaultValue: OrderStatus.NEW,
      },
      totalAmountInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      /**
       * Copied at checkout, not joined from `user_addresses`. A customer
       * editing or deleting a saved address afterwards must not rewrite
       * where an already-shipped order went.
       */
      shippingAddress: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      /** Set alongside CANCELLED/RETURNED; surfaced verbatim on the order detail screen. */
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      placedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      /** Set when status reaches DELIVERED — the same transition that writes the EARNING ledger row. */
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
    }
  );

  return Order;
};
