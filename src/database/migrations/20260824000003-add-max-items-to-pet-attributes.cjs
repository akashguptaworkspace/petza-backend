'use strict';

/**
 * How many files/photos a FILE or MEDIA attribute accepts.
 *
 * Without it the app has to know by heart that "main photo" means one and
 * "additional photos" means nine — exactly the hardcoded knowledge the
 * data-driven form exists to remove. NULL for every other input type,
 * which is why it isn't NOT NULL with a default.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_attributes', 'max_items', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pet_attributes', 'max_items');
  },
};
