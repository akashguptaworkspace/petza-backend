'use strict';

/**
 * A pet a kennel has listed for sale.
 *
 * Hybrid on purpose. The columns below are the ones something *queries* —
 * the customer app filters on species, breed, gender, size and price, and
 * the partner's own list sorts on status and date. Everything else the
 * dynamic form collects (coat, temperament, training, pedigree, parents,
 * health notes) lives in `attributes` as JSON, keyed by the same
 * `pet_attributes.key` the form was built from.
 *
 * The alternative — a row per answer, mirroring `pet_attributes` exactly —
 * would model the form perfectly and make "dogs under ₹30,000 in Pune"
 * a self-join per filter. The alternative in the other direction — a column
 * per question — puts a migration between the partner and every new
 * question, which is the thing the data-driven form exists to avoid.
 *
 * So: promote what is filtered on, keep the long tail flexible. Moving a
 * key out of `attributes` into its own column later is a backfill, not a
 * redesign.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pet_listings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      /** Never taken from a request body — always `req.store.id`. */
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** STRING, not ENUM — same reason as pet_attributes.pet_type: a new species is a seed change. */
      pet_type: { type: Sequelize.STRING(32), allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false },
      slug: { type: Sequelize.STRING(160), allowNull: false, unique: true },

      /** Option `value`s from pet_attribute_options, not free text — that is what makes them filterable. */
      breed: { type: Sequelize.STRING(64), allowNull: true },
      /** Set only when breed is the "Other" sentinel, so a curated list never blocks an unusual dog. */
      breed_other: { type: Sequelize.STRING(120), allowNull: true },
      gender: { type: Sequelize.STRING(16), allowNull: true },
      size: { type: Sequelize.STRING(24), allowNull: true },
      colors: { type: Sequelize.JSON, allowNull: false },

      date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
      /** Denormalised from date_of_birth at write time so a list query doesn't recompute it per row. Refreshed on update. */
      age_label: { type: Sequelize.STRING(32), allowNull: true },
      weight_kg: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },

      price_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      price_type: { type: Sequelize.STRING(24), allowNull: true },

      /**
       * AVAILABLE on create — the add-pet form does not ask, because a
       * listing being created is by definition available. It moves on from
       * here through the listing's own actions.
       */
      status: {
        type: Sequelize.ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'AVAILABLE',
      },

      /** Everything else the form collected, keyed by pet_attributes.key. */
      attributes: { type: Sequelize.JSON, allowNull: false },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // The partner's own list: "my listings, by status, newest first".
    await queryInterface.addIndex('pet_listings', ['store_id', 'status', 'created_at'], {
      name: 'pet_listings_store_status_created',
    });
    // The customer browse/filter path.
    await queryInterface.addIndex('pet_listings', ['status', 'pet_type', 'price_in_inr'], {
      name: 'pet_listings_status_type_price',
    });
    await queryInterface.addIndex('pet_listings', ['breed'], { name: 'pet_listings_breed' });

    await queryInterface.createTable('pet_listing_media', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      pet_listing_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pet_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Server-relative path (`/uploads/pets/…`), resolved against the API host by whichever app renders it. */
      url: { type: Sequelize.STRING(512), allowNull: false },
      type: { type: Sequelize.ENUM('PHOTO', 'VIDEO'), allowNull: false },
      /** Exactly one per listing — the card image. Enforced in the service, not by a constraint, because MySQL has no partial unique index. */
      is_main: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('pet_listing_media', ['pet_listing_id', 'position'], {
      name: 'pet_listing_media_listing_position',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pet_listing_media');
    await queryInterface.dropTable('pet_listings');
  },
};
