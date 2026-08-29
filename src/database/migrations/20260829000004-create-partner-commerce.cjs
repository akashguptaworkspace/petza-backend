'use strict';

/**
 * The two demand-side tables — PRODUCT_CONTEXT.md §5 and §7.
 *
 * An order is products; a booking is a service. They stay separate for the
 * same reason their listings do: an order ships to an address and moves
 * New → Packed → Shipped → Delivered, while a booking happens at a time
 * and moves Upcoming → In Progress → Completed. Sharing a table would mean
 * one status enum that is wrong for both.
 *
 * Both terminal-success states (DELIVERED, COMPLETED) are what write an
 * EARNING row into `wallet_transactions`.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const storeId = {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    };
    // The buyer is a customer-app account. RESTRICT rather than CASCADE:
    // deleting a user must not silently erase a partner's sales history.
    const customerUserId = {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    };
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    };

    await queryInterface.createTable('orders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: storeId,
      customer_user_id: customerUserId,
      /** The short human reference both sides quote in chat — "PTZ-4821". A UUID is unusable for that. */
      order_number: { type: Sequelize.STRING(24), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('NEW', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'NEW',
      },
      total_amount_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      /**
       * Copied at checkout, not joined from `user_addresses`. The customer
       * editing or deleting a saved address afterwards must not rewrite
       * where an already-shipped order went.
       */
      shipping_address: { type: Sequelize.JSON, allowNull: false },
      /** Set alongside CANCELLED/RETURNED; surfaced on the order detail screen. */
      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      placed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      delivered_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });

    // The Orders tab: this store's orders under the selected status tab,
    // newest first.
    await queryInterface.addIndex('orders', ['store_id', 'status', 'created_at'], {
      name: 'orders_store_status_created',
    });
    await queryInterface.addIndex('orders', ['customer_user_id'], { name: 'orders_customer_user_id' });

    await queryInterface.createTable('order_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // RESTRICT for the same reason as the customer above: the listing a
      // past order points at has to stay resolvable.
      product_listing_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'product_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      /**
       * Snapshots taken at checkout. The partner is free to rename or
       * reprice a listing afterwards, and an old order must still render
       * what was actually bought and charged.
       */
      product_name: { type: Sequelize.STRING, allowNull: false },
      product_image_url: { type: Sequelize.TEXT, allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      price_at_purchase_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      ...timestamps,
    });

    await queryInterface.addIndex('order_items', ['order_id'], { name: 'order_items_order_id' });
    await queryInterface.addIndex('order_items', ['product_listing_id'], { name: 'order_items_product_listing_id' });

    await queryInterface.createTable('bookings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: storeId,
      customer_user_id: customerUserId,
      service_listing_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'service_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      booking_number: { type: Sequelize.STRING(24), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'UPCOMING',
      },
      /** Snapshot, same reasoning as `order_items.product_name`. */
      service_name: { type: Sequelize.STRING, allowNull: false },
      scheduled_at: { type: Sequelize.DATE, allowNull: false },
      /** Copied from the listing at booking time — shortening a service later must not shrink appointments already taken. */
      duration_minutes: { type: Sequelize.INTEGER, allowNull: false },
      price_at_booking_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      location_type: { type: Sequelize.ENUM('AT_STORE', 'HOME_VISIT'), allowNull: false, defaultValue: 'AT_STORE' },
      /** Only set for HOME_VISIT; snapshotted like a shipping address. */
      visit_address: { type: Sequelize.JSON, allowNull: true },
      customer_note: { type: Sequelize.TEXT, allowNull: true },
      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });

    // Serves both the Bookings status tabs and the calendar view, which
    // reads the same rows ordered by when they happen rather than when
    // they were made.
    await queryInterface.addIndex('bookings', ['store_id', 'status', 'scheduled_at'], {
      name: 'bookings_store_status_scheduled',
    });
    await queryInterface.addIndex('bookings', ['service_listing_id', 'scheduled_at'], {
      name: 'bookings_listing_scheduled',
    });
    await queryInterface.addIndex('bookings', ['customer_user_id'], { name: 'bookings_customer_user_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bookings');
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');
  },
};
