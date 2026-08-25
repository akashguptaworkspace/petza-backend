'use strict';

/**
 * Lets a customer message the PERSON who listed a pet, not just a store.
 *
 * `enquiries.store_id` was NOT NULL and denormalized off
 * `pet_listings.store_id`. Since a customer can now list their own pet
 * (see the pet-listings-individual-owners migration), that column is null
 * on their listings — so "Message the seller" on one died at the driver
 * with "Column 'store_id' cannot be null".
 *
 * Same shape as the fix on `pet_listings`, for the same reasons: a
 * nullable pair with a real foreign key on each side, exactly one set per
 * row, enforced in the service where the error can be readable. A thread
 * belongs to a store OR to an individual seller, never both.
 *
 * ⚠️ The two column alterations below are drop-FK → MODIFY → re-add-FK and
 * restate `COLLATE utf8mb4_bin`. Both are load-bearing on MySQL — see the
 * long note in the pet-listings migration for what silently breaks
 * otherwise (a duplicate constraint plus a column that stays NOT NULL, and
 * an "incompatible columns" refusal on the foreign key).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [fks] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'enquiries'
        AND COLUMN_NAME = 'store_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    for (const { CONSTRAINT_NAME } of fks) {
      await queryInterface.sequelize.query(`ALTER TABLE enquiries DROP FOREIGN KEY \`${CONSTRAINT_NAME}\``);
    }

    await queryInterface.sequelize.query(
      'ALTER TABLE enquiries MODIFY store_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    await queryInterface.addConstraint('enquiries', {
      fields: ['store_id'],
      type: 'foreign key',
      name: 'enquiries_store_id_fk',
      references: { table: 'stores', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    /** Denormalized from pet_listings.individual_owner_id, exactly as store_id is from store_id. */
    await queryInterface.addColumn('enquiries', 'individual_owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: "The person who listed the pet, when it isn't a store's listing.",
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE enquiries MODIFY individual_owner_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    await queryInterface.addConstraint('enquiries', {
      fields: ['individual_owner_id'],
      type: 'foreign key',
      name: 'enquiries_individual_owner_id_fk',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // "Threads about pets I listed, newest activity first" — the private
    // seller's own inbox, mirroring the store inbox index.
    await queryInterface.addIndex('enquiries', ['individual_owner_id', 'last_message_at'], {
      name: 'enquiries_owner_last_message',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('enquiries', 'enquiries_individual_owner_id_fk').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'enquiries_owner_last_message').catch(() => {});
    await queryInterface.removeColumn('enquiries', 'individual_owner_id');

    await queryInterface.sequelize.query('DELETE FROM enquiries WHERE store_id IS NULL');
    await queryInterface.removeConstraint('enquiries', 'enquiries_store_id_fk').catch(() => {});
    await queryInterface.sequelize.query(
      'ALTER TABLE enquiries MODIFY store_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    await queryInterface.addConstraint('enquiries', {
      fields: ['store_id'],
      type: 'foreign key',
      name: 'enquiries_store_id_fk',
      references: { table: 'stores', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
};
