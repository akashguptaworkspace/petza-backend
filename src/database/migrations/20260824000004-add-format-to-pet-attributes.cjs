'use strict';

/**
 * How a value should be presented — currently only 'INR', which tells the
 * app to group a price the Indian way (₹45,000 / ₹1,20,000) as it is typed.
 *
 * A hint, not a type: the answer is still a plain number string, and the
 * grouping never reaches storage. Without it the app would have to know by
 * heart that `priceInInr` is money while `weightKg` beside it is not —
 * exactly the hardcoded knowledge the data-driven form exists to remove.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_attributes', 'format', {
      type: Sequelize.STRING(24),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pet_attributes', 'format');
  },
};
