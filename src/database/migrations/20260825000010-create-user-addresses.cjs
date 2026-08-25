'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_addresses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('HOME', 'WORK', 'OTHER', 'PARENTS_HOME'),
        allowNull: false,
        defaultValue: 'HOME',
      },
      full_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mobile_number: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      pincode: {
        type: Sequelize.STRING(12),
        allowNull: false,
      },
      address_line: {
        type: Sequelize.STRING(240),
        allowNull: false,
      },
      landmark: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'India',
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex('user_addresses', ['user_id', 'created_at']);
    await queryInterface.addIndex('user_addresses', ['user_id', 'is_default']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_addresses');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_user_addresses_type;').catch(() => {});
  },
};
