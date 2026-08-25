'use strict';

/**
 * Lets an ordinary customer list their own pet — for sale or to rehome —
 * in the same table a partner store publishes into.
 *
 * ## Why the same table rather than a `donation_listings` of its own
 *
 * A pet listed by a person is not a structurally different thing from one
 * listed by a kennel: same name/breed/gender/age/health/media/attributes,
 * same detail screen, same wishlist, same search index, same
 * `pet/[id]` route. The app is deliberately built around ONE browse
 * surface (see petza-app's "one browse screen" rule); a second table would
 * force every read path — catalogue, search, wishlist, related rails,
 * enquiries — to query two sources and merge them. Only two things
 * genuinely differ, and both are columns:
 *
 *   who owns it   → `store_id` OR `individual_owner_id`, exactly one set
 *   what it is    → `listing_type`
 *
 * ## Exactly one owner
 *
 * `store_id` becomes nullable and gains a sibling. This is the same
 * nullable-FK-pair shape `wishlist_items` uses, chosen for the same reason:
 * it keeps a REAL foreign key (and ON DELETE CASCADE) on each side, which a
 * polymorphic `(owner_type, owner_id)` pair cannot have. The
 * "exactly one" rule is enforced in the service — MySQL 8 CHECK
 * constraints exist but Sequelize's migration API has no portable way to
 * express one, and the rule needs a readable error either way.
 *
 * ## Why individuals do not get a Store row instead
 *
 * `stores` is a KYC-gated business entity: `business_type` is
 * KENNEL|VET|TRAINER with no "individual" member, and `status` starts at
 * PENDING_KYC and only becomes publicly visible after an admin review
 * (`reviewed_at`, `rejection_reason`). Auto-creating one per person would
 * either make someone rehoming a dog this week wait on KYC approval, or
 * quietly bypass that review and fill the public store directory with
 * one-off "businesses" that were never real sellers.
 *
 * ## Price
 *
 * `price_in_inr` becomes nullable, because a rehomed pet has no price. It
 * is NOT how sale-vs-adoption is decided — a partner can already publish a
 * ₹0 sale listing and the app shows "No adoption fee" for it — so the
 * meaning lives in `listing_type` and nowhere else.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * A listing owned by a person has no store. Existing rows all have one,
     * so nothing is backfilled.
     *
     * ⚠️ Done as drop-FK → MODIFY → re-add-FK rather than `changeColumn`.
     * MySQL will not alter a column that a foreign key sits on, and
     * Sequelize's `changeColumn` does not surface that: passing
     * `references` again made it add a SECOND, duplicate constraint
     * (`pet_listings_ibfk_2`) and silently leave the column NOT NULL. The
     * migration reported success and every insert without a store_id then
     * failed at the driver with "Column 'store_id' cannot be null".
     * If you ever need to change nullability on an FK column here, use
     * this shape, not `changeColumn`.
     */
    const [fks] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'pet_listings'
        AND COLUMN_NAME = 'store_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    for (const { CONSTRAINT_NAME } of fks) {
      await queryInterface.sequelize.query(`ALTER TABLE pet_listings DROP FOREIGN KEY \`${CONSTRAINT_NAME}\``);
    }

    // COLLATE is not optional here. The UUID primary keys in this schema are
    // CHAR(36) utf8mb4_bin; a bare `MODIFY ... CHAR(36)` re-creates the
    // column with the table's default collation (utf8mb4_0900_ai_ci), and
    // MySQL then refuses to re-add the foreign key — "Referencing column
    // and referenced column ... are incompatible". Restate the collation on
    // every MODIFY of an FK column in this schema.
    await queryInterface.sequelize.query(
      'ALTER TABLE pet_listings MODIFY store_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );

    await queryInterface.addConstraint('pet_listings', {
      fields: ['store_id'],
      type: 'foreign key',
      name: 'pet_listings_store_id_fk',
      references: { table: 'stores', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('pet_listings', 'individual_owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Set when a customer listed this pet themselves; null for a partner store listing.',
    });
    // Match users.id (utf8mb4_bin) so the foreign key below is accepted — see
    // the store_id note above.
    await queryInterface.sequelize.query(
      'ALTER TABLE pet_listings MODIFY individual_owner_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    await queryInterface.addConstraint('pet_listings', {
      fields: ['individual_owner_id'],
      type: 'foreign key',
      name: 'pet_listings_individual_owner_id_fk',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Defaulting to SALE is what makes this migration a no-op for the
    // partner catalogue that already exists — every current row IS a sale.
    await queryInterface.addColumn('pet_listings', 'listing_type', {
      type: Sequelize.ENUM('SALE', 'ADOPTION'),
      allowNull: false,
      defaultValue: 'SALE',
    });

    // A rehomed pet has no price. No FK on this one, so a plain MODIFY is fine.
    await queryInterface.sequelize.query('ALTER TABLE pet_listings MODIFY price_in_inr INT NULL');

    // "My listings", newest first — the customer's own list screen.
    await queryInterface.addIndex('pet_listings', ['individual_owner_id', 'status', 'created_at'], {
      name: 'pet_listings_owner_status_created',
    });
    // The Adopt / Rehome feed: publicly-visible adoption listings, newest first.
    await queryInterface.addIndex('pet_listings', ['listing_type', 'status', 'created_at'], {
      name: 'pet_listings_type_status_created',
    });
  },

  async down(queryInterface, Sequelize) {
    // The owner FK has to go before its backing index can be dropped.
    await queryInterface.removeConstraint('pet_listings', 'pet_listings_individual_owner_id_fk').catch(() => {});
    await queryInterface.removeIndex('pet_listings', 'pet_listings_type_status_created').catch(() => {});
    await queryInterface.removeIndex('pet_listings', 'pet_listings_owner_status_created').catch(() => {});
    await queryInterface.removeColumn('pet_listings', 'listing_type');
    await queryInterface.removeColumn('pet_listings', 'individual_owner_id');

    // Reverting store_id to NOT NULL would fail while any individually-owned
    // listing exists, so those go first — they cannot be represented at all
    // in the pre-migration schema.
    await queryInterface.sequelize.query('DELETE FROM pet_listings WHERE store_id IS NULL');
    await queryInterface.removeConstraint('pet_listings', 'pet_listings_store_id_fk').catch(() => {});
    await queryInterface.sequelize.query(
      'ALTER TABLE pet_listings MODIFY store_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    await queryInterface.addConstraint('pet_listings', {
      fields: ['store_id'],
      type: 'foreign key',
      name: 'pet_listings_store_id_fk',
      references: { table: 'stores', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.sequelize.query('ALTER TABLE pet_listings MODIFY price_in_inr INT NOT NULL');
  },
};
