'use strict';

/**
 * What a partner actually sells — PRODUCT_CONTEXT.md §5.
 *
 * Products and services get separate tables rather than one polymorphic
 * `listings` table because almost nothing about them overlaps: a product
 * has stock, an MRP and a SKU; a service has a duration, a location type
 * and a weekly availability grid. Folding them together would mean two
 * thirds of every row being null.
 *
 * Both carry the same two-part gate (§8): a listing is visible to
 * customers only when the partner has set `status = ACTIVE` *and* an admin
 * has set `moderation_status = APPROVED`. Neither side can publish alone.
 *
 * Money is a whole number of rupees in an INTEGER, matching every other
 * price column in this schema — never a float.
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
    const moderation = {
      moderation_status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      /** Shown to the partner verbatim when a listing comes back rejected. */
      moderation_note: { type: Sequelize.TEXT, allowNull: true },
      moderated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      moderated_at: { type: Sequelize.DATE, allowNull: true },
    };
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    };

    await queryInterface.createTable('product_listings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: storeId,
      /** Always the "Accessories" parent — kept as a real column so the taxonomy can grow a second product root without a migration. */
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      /** The subcategory tag — Food, Toys, Hygiene. This is what drives the dynamic fields and the shopper's filters. */
      tag_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      price_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      /** Struck-through "was" price. Null when the partner isn't running one. */
      mrp_in_inr: { type: Sequelize.INTEGER, allowNull: true },
      stock_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sku: { type: Sequelize.STRING, allowNull: true },
      /** Array of URLs, first one is the cover. */
      images: { type: Sequelize.JSON, allowNull: false },
      /** Answers to this tag's `category_attributes`, keyed by `attribute_key`. */
      attributes: { type: Sequelize.JSON, allowNull: false },
      status: {
        type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'OUT_OF_STOCK'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      ...moderation,
      ...timestamps,
    });

    // The Listings tab, exactly: this store's products, filtered by status
    // chip, newest first.
    await queryInterface.addIndex('product_listings', ['store_id', 'status', 'created_at'], {
      name: 'product_listings_store_status_created',
    });
    // The admin moderation queue: everything pending across all partners,
    // oldest first.
    await queryInterface.addIndex('product_listings', ['moderation_status', 'created_at'], {
      name: 'product_listings_moderation_created',
    });
    await queryInterface.addIndex('product_listings', ['tag_id'], { name: 'product_listings_tag_id' });

    await queryInterface.createTable('service_listings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: storeId,
      /** One of the seven service categories. Flat — services have no tag level. */
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      /** How long one booking blocks out. Drives the slot grid in `service_availability`. */
      duration_minutes: { type: Sequelize.INTEGER, allowNull: false },
      price_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      location_type: {
        type: Sequelize.ENUM('AT_STORE', 'HOME_VISIT'),
        allowNull: false,
        defaultValue: 'AT_STORE',
      },
      attributes: { type: Sequelize.JSON, allowNull: false },
      images: { type: Sequelize.JSON, allowNull: false },
      // No OUT_OF_STOCK member: a service doesn't run out, it gets paused.
      status: {
        type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'PAUSED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      ...moderation,
      ...timestamps,
    });

    await queryInterface.addIndex('service_listings', ['store_id', 'status', 'created_at'], {
      name: 'service_listings_store_status_created',
    });
    await queryInterface.addIndex('service_listings', ['moderation_status', 'created_at'], {
      name: 'service_listings_moderation_created',
    });

    /**
     * A recurring weekly grid, not a calendar of dates: one row per
     * (service, weekday, window). "Mon–Fri 9am–1pm" is five rows. Actual
     * bookings land in `bookings` and are checked against this.
     */
    await queryInterface.createTable('service_availability', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      service_listing_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'service_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** 0 = Sunday, matching JavaScript's `Date#getDay`, so neither side has to re-base the number. */
      day_of_week: { type: Sequelize.TINYINT, allowNull: false },
      start_time: { type: Sequelize.TIME, allowNull: false },
      end_time: { type: Sequelize.TIME, allowNull: false },
      /** How many customers can hold the same slot — a groomer with two tables takes 2. */
      max_bookings_per_slot: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...timestamps,
    });

    await queryInterface.addIndex('service_availability', ['service_listing_id', 'day_of_week', 'start_time'], {
      name: 'service_availability_listing_day_start',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('service_availability');
    await queryInterface.dropTable('service_listings');
    await queryInterface.dropTable('product_listings');
  },
};
