'use strict';

/**
 * Partner onboarding's data layer: the store a partner resolves to, its
 * KYC documents, and one profile table per business type.
 *
 * `business_type` has no PET_SHOP member on purpose — a pet shop and a
 * breeder run the same storefront on Petza, so both are KENNEL (see
 * src/config/constants.js).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      owner_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Null between "picked a business type" and "submitted KYC" — the
      // role screen creates the row, the KYC form names the business.
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      business_type: {
        type: Sequelize.ENUM('KENNEL', 'VET', 'TRAINER'),
        allowNull: false,
      },
      capabilities: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      status: {
        type: Sequelize.ENUM('PENDING_KYC', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING_KYC',
      },
      owner_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      kyc_submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // `capabilities` is a SET on the model; createTable can't express one,
    // so it's declared above as a STRING and widened here — a SET stores
    // exactly the same comma-joined string, so no data conversion happens.
    await queryInterface.sequelize.query(
      "ALTER TABLE stores MODIFY capabilities SET('SELL_PETS','SELL_SUPPLIES','PROVIDE_CARE') NOT NULL DEFAULT ''"
    );

    // The admin KYC queue reads exactly this: "every store waiting on
    // review, oldest first".
    await queryInterface.addIndex('stores', ['status', 'kyc_submitted_at'], { name: 'stores_status_kyc_submitted_at' });

    await queryInterface.createTable('store_kyc_documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex('store_kyc_documents', ['store_id'], { name: 'store_kyc_documents_store_id' });

    const profileStoreId = {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    };
    const timestamps = {
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    };

    await queryInterface.createTable('kennel_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: profileStoreId,
      years_active: { type: Sequelize.INTEGER, allowNull: true },
      registration_number: { type: Sequelize.STRING, allowNull: true },
      pincode: { type: Sequelize.STRING(10), allowNull: true },
      breeds: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });

    await queryInterface.createTable('vet_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: profileStoreId,
      council_registration_number: { type: Sequelize.STRING, allowNull: true },
      services: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });

    await queryInterface.createTable('trainer_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: profileStoreId,
      experience_years: { type: Sequelize.INTEGER, allowNull: true },
      certification_body: { type: Sequelize.STRING, allowNull: true },
      certification_number: { type: Sequelize.STRING, allowNull: true },
      base_area: { type: Sequelize.STRING, allowNull: true },
      travel_radius_km: { type: Sequelize.INTEGER, allowNull: true },
      training_offered: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });

    // users.partner_store_id predates this table as a denormalized
    // placeholder. It stays a plain column rather than becoming a foreign
    // key: users ⇄ stores would then reference each other in both
    // directions, and any database already seeded with a placeholder
    // partner_store_id would fail this migration outright. The index is
    // what the lookups actually need.
    await queryInterface.addIndex('users', ['partner_store_id'], { name: 'users_partner_store_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_partner_store_id');
    await queryInterface.dropTable('trainer_profiles');
    await queryInterface.dropTable('vet_profiles');
    await queryInterface.dropTable('kennel_profiles');
    await queryInterface.dropTable('store_kyc_documents');
    await queryInterface.dropTable('stores');
  },
};
