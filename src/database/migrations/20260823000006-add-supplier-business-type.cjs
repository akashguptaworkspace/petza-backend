'use strict';

/**
 * A business whose whole trade is supplies gets its own business type.
 *
 * It needs no new capability — SELL_SUPPLIES already exists and already
 * has a dashboard — only a type to sign up as and a profile table for the
 * proofs a trading business is verified on (GST rather than a licence).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER','SUPPLIER') NOT NULL"
    );

    await queryInterface.createTable('supplier_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      gst_number: { type: Sequelize.STRING(20), allowNull: true },
      warehouse_city: { type: Sequelize.STRING, allowNull: true },
      brands_stocked: { type: Sequelize.JSON, allowNull: false },
      categories: { type: Sequelize.JSON, allowNull: false },
      ships_nationwide: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('supplier_profiles');
    await queryInterface.sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER') NOT NULL"
    );
  },
};
