'use strict';

/**
 * Collapses the partner model down to the two capability flags described in
 * petza-partner/PRODUCT_CONTEXT.md §3.
 *
 * Before this migration a partner was defined by their *business type* —
 * KENNEL / VET / TRAINER / GROOMER / SUPPLIER — and each type mapped to a
 * capability in a `capabilities` SET, which in turn mapped to one of three
 * separate dashboards in the partner app. That is gone. There is now one
 * partner dashboard, and the only thing that varies is which of two
 * booleans is on:
 *
 *   offers_products  — sells pet supplies
 *   offers_services  — offers bookable services
 *
 * `business_type` survives, but demoted: it now describes the *shape* of
 * the business (Individual Seller / Store / Clinic / Groomer) for KYC and
 * admin filtering, and no longer decides a single thing about navigation.
 *
 * Pets leave the partner side entirely. `pet_listings` and everything
 * around it stay — the customer app still browses them and individual
 * owners still list them — but no partner capability points at them any
 * more, so the per-business-type profile tables that existed only to feed
 * the old KENNEL/VET/TRAINER dashboards are dropped.
 *
 * `products`/`product_variants` are dropped too, replaced by
 * `product_listings` in 20260829000003. The old shape carried pack-size
 * variants each with their own price and stock; the spec's listing is flat
 * and partner-authored, with dynamic attributes instead of variants, so
 * this is a replacement rather than a migration of one into the other.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await queryInterface.addColumn('stores', 'offers_products', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('stores', 'offers_services', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Collected on the KYC form alongside city/state/pincode, which already
    // exist — this is the street line those were missing.
    await queryInterface.addColumn('stores', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Carry the existing dev stores across rather than stranding them:
    // whatever they could do before, they can still do, minus pets.
    await sequelize.query("UPDATE stores SET offers_products = 1 WHERE FIND_IN_SET('SELL_SUPPLIES', capabilities)");
    await sequelize.query("UPDATE stores SET offers_services = 1 WHERE FIND_IN_SET('PROVIDE_CARE', capabilities)");
    // A store whose only capability was SELL_PETS would land on zero
    // capabilities and be unable to open anything, so it becomes a
    // supplies seller — the closest thing to "sells something".
    await sequelize.query('UPDATE stores SET offers_products = 1 WHERE offers_products = 0 AND offers_services = 0');

    // business_type has to be widened to hold both the old and new members
    // at once, because the UPDATE that translates them can only run while
    // both sets are legal.
    await sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER','SUPPLIER','INDIVIDUAL','STORE','CLINIC') NOT NULL"
    );
    await sequelize.query(`
      UPDATE stores SET business_type = CASE business_type
        WHEN 'VET' THEN 'CLINIC'
        WHEN 'GROOMER' THEN 'GROOMER'
        WHEN 'TRAINER' THEN 'INDIVIDUAL'
        ELSE 'STORE'
      END
    `);
    await sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('INDIVIDUAL','STORE','CLINIC','GROOMER') NOT NULL DEFAULT 'INDIVIDUAL'"
    );

    await queryInterface.removeColumn('stores', 'capabilities');

    // KYC documents grow the reviewer trail the admin console needs. The
    // spec calls this table `partner_documents`; it already exists here as
    // `store_kyc_documents` with the same shape, so it is extended rather
    // than duplicated under a second name.
    await queryInterface.addColumn('store_kyc_documents', 'doc_type', {
      type: Sequelize.ENUM('IDENTITY', 'BUSINESS_LICENSE', 'GST', 'CLINIC_REGISTRATION', 'CERTIFICATION', 'OTHER'),
      allowNull: false,
      defaultValue: 'OTHER',
    });
    await queryInterface.addColumn('store_kyc_documents', 'status', {
      type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    });
    await queryInterface.addColumn('store_kyc_documents', 'rejection_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('store_kyc_documents', 'reviewed_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('store_kyc_documents', 'reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('products');

    await queryInterface.dropTable('kennel_profiles');
    await queryInterface.dropTable('vet_profiles');
    await queryInterface.dropTable('trainer_profiles');
    await queryInterface.dropTable('groomer_profiles');
    await queryInterface.dropTable('supplier_profiles');
  },

  /**
   * Restores the columns and the old enum, but NOT the dropped tables'
   * rows — the profile and product tables come back empty. The forward
   * migration is destructive by design (see PRODUCT_CONTEXT.md §10:
   * replace, don't merge), so this exists to let a developer step back
   * onto the old schema, not to recover data.
   */
  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    const profileStoreId = {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    };
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
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
    await queryInterface.createTable('groomer_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: profileStoreId,
      experience_years: { type: Sequelize.INTEGER, allowNull: true },
      services_offered: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable('supplier_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: profileStoreId,
      gst_number: { type: Sequelize.STRING, allowNull: true },
      categories: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });

    await queryInterface.createTable('products', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      brand: { type: Sequelize.STRING, allowNull: true },
      category_slug: { type: Sequelize.STRING, allowNull: false },
      pet_types: { type: Sequelize.JSON, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'ARCHIVED'), allowNull: false, defaultValue: 'DRAFT' },
      ...timestamps,
    });
    await queryInterface.addIndex('products', ['store_id', 'status', 'created_at'], {
      name: 'products_store_status_created_at',
    });
    await queryInterface.addIndex('products', ['category_slug'], { name: 'products_category_slug' });

    await queryInterface.createTable('product_variants', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: { type: Sequelize.STRING, allowNull: false },
      sku: { type: Sequelize.STRING, allowNull: true },
      price_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      mrp_in_inr: { type: Sequelize.INTEGER, allowNull: true },
      stock_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      low_stock_threshold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex('product_variants', ['product_id', 'position'], {
      name: 'product_variants_product_position',
    });

    await queryInterface.removeColumn('store_kyc_documents', 'reviewed_at');
    await queryInterface.removeColumn('store_kyc_documents', 'reviewed_by');
    await queryInterface.removeColumn('store_kyc_documents', 'rejection_reason');
    await queryInterface.removeColumn('store_kyc_documents', 'status');
    await queryInterface.removeColumn('store_kyc_documents', 'doc_type');

    await queryInterface.addColumn('stores', 'capabilities', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    });
    await sequelize.query(
      "ALTER TABLE stores MODIFY capabilities SET('SELL_PETS','SELL_SUPPLIES','PROVIDE_CARE') NOT NULL DEFAULT ''"
    );
    await sequelize.query("UPDATE stores SET capabilities = 'SELL_SUPPLIES' WHERE offers_products = 1");
    await sequelize.query("UPDATE stores SET capabilities = 'PROVIDE_CARE' WHERE offers_services = 1 AND offers_products = 0");
    await sequelize.query(
      "UPDATE stores SET capabilities = 'SELL_SUPPLIES,PROVIDE_CARE' WHERE offers_services = 1 AND offers_products = 1"
    );

    await sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER','SUPPLIER','INDIVIDUAL','STORE','CLINIC') NOT NULL"
    );
    await sequelize.query(`
      UPDATE stores SET business_type = CASE business_type
        WHEN 'CLINIC' THEN 'VET'
        WHEN 'GROOMER' THEN 'GROOMER'
        WHEN 'INDIVIDUAL' THEN 'TRAINER'
        ELSE 'SUPPLIER'
      END
    `);
    await sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER','SUPPLIER') NOT NULL"
    );

    await queryInterface.removeColumn('stores', 'address');
    await queryInterface.removeColumn('stores', 'offers_services');
    await queryInterface.removeColumn('stores', 'offers_products');
  },
};
