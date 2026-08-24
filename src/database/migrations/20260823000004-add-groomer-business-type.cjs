'use strict';

/**
 * Grooming joins the care pillar.
 *
 * A groomer sells slots exactly like a vet or a trainer does, so it needs
 * no new capability and no new dashboard — only its own business type and
 * the profile table holding the proofs specific to it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER','GROOMER') NOT NULL"
    );

    await queryInterface.createTable('groomer_profiles', {
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
      experience_years: { type: Sequelize.INTEGER, allowNull: true },
      is_mobile: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      services: { type: Sequelize.JSON, allowNull: false },
      pet_types: { type: Sequelize.JSON, allowNull: false },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('groomer_profiles');
    // Any store that had signed up as a groomer would no longer have a
    // valid type, so this only reverses cleanly on a database where none
    // has — which is exactly when a rollback makes sense.
    await queryInterface.sequelize.query(
      "ALTER TABLE stores MODIFY business_type ENUM('KENNEL','VET','TRAINER') NOT NULL"
    );
  },
};
