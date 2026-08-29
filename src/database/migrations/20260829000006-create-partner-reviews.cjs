'use strict';

/**
 * Customer ratings on a completed transaction — PRODUCT_CONTEXT.md §5,
 * behind Profile → Reviews & Ratings.
 *
 * A review always hangs off something that actually happened: an order or
 * a booking, never a bare store. That is what stops a partner being rated
 * by someone who never bought from them, and it is why `reference_type` +
 * `reference_id` are required rather than optional.
 *
 * Like listings, reviews are moderated (§8) — a flagged review is held at
 * PENDING and never reaches the customer app.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      customer_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Polymorphic for the same reason as `wallet_transactions.reference_type` — one column, two possible tables. */
      reference_type: { type: Sequelize.ENUM('ORDER', 'BOOKING'), allowNull: false },
      reference_id: { type: Sequelize.UUID, allowNull: false },
      /** 1–5. TINYINT rather than INTEGER because the range is fixed and tiny. */
      rating: { type: Sequelize.TINYINT, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      /** The partner's public answer. One per review, so it lives here rather than in a replies table. */
      partner_reply: { type: Sequelize.TEXT, allowNull: true },
      partner_replied_at: { type: Sequelize.DATE, allowNull: true },
      moderation_status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      /** Raised by a customer or the partner; what puts a row in the admin moderation queue. */
      is_flagged: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // The partner's Reviews screen and the store rating average.
    await queryInterface.addIndex('reviews', ['store_id', 'moderation_status', 'created_at'], {
      name: 'reviews_store_moderation_created',
    });
    // One review per transaction — a second attempt is an edit, not a new row.
    await queryInterface.addIndex('reviews', ['reference_type', 'reference_id'], {
      name: 'reviews_reference',
      unique: true,
    });
    // The admin queue reads flagged-first, oldest-first.
    await queryInterface.addIndex('reviews', ['is_flagged', 'moderation_status'], {
      name: 'reviews_flagged_moderation',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reviews');
  },
};
