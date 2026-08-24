'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Google/OTP-registered accounts may have no password, and phone-only
    // OTP accounts may have no email — both become optional at the DB
    // level; the service layer still requires at least one of email/phone.
    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex('users', ['phone'], {
      unique: true,
      name: 'users_phone_unique',
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE users ADD CONSTRAINT chk_users_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE users DROP CHECK chk_users_contact');
    await queryInterface.removeIndex('users', 'users_phone_unique');
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
