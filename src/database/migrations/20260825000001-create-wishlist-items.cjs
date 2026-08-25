'use strict';

/**
 * A customer's saved pets and stores — the Wishlist tab in petza-app.
 *
 * One table rather than `wishlist_pets` + `wishlist_stores`, because the
 * two are the same act ("save this for later") by the same user, read
 * together on every wishlist open, and ordered together by when they were
 * saved. Splitting them would mean two queries and two sorts to render one
 * screen that shows a single "Recently added" order across both tabs.
 *
 * Both target columns are nullable and exactly one is set per row. That
 * keeps a REAL foreign key on each — a polymorphic `(item_type, item_id)`
 * pair cannot be constrained, and orphaned saves are precisely the failure
 * this table must not have: when a partner archives a listing or a store
 * is deactivated, ON DELETE CASCADE removes it from every wishlist that
 * held it, rather than leaving ids that resolve to nothing (the exact
 * problem the app's pre-seeded wishlist had — see wishlistSlice.ts).
 *
 * The unique indexes are per-column pairs, not one composite: MySQL treats
 * NULLs as distinct in a unique index, so `(user_id, pet_listing_id)`
 * permits the many `(user, NULL)` rows that a user's store saves produce,
 * while still allowing a given pet to be saved by a given user only once.
 * That uniqueness is also the "is it already saved" check the toggle
 * relies on.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wishlist_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Set when this row saves a pet; NULL when it saves a store. */
      pet_listing_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'pet_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Set when this row saves a store; NULL when it saves a pet. */
      store_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // A pet is in a user's wishlist once or not at all — also the existence
    // check the toggle relies on. NULLs compare as distinct, so this does
    // not restrict the store rows.
    await queryInterface.addIndex('wishlist_items', ['user_id', 'pet_listing_id'], {
      name: 'wishlist_items_user_pet_unique',
      unique: true,
    });
    await queryInterface.addIndex('wishlist_items', ['user_id', 'store_id'], {
      name: 'wishlist_items_user_store_unique',
      unique: true,
    });
    // "My wishlist, most recently saved first" — the screen's default order.
    await queryInterface.addIndex('wishlist_items', ['user_id', 'created_at'], {
      name: 'wishlist_items_user_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wishlist_items');
  },
};
