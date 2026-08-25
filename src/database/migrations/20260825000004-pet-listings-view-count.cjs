'use strict';

/**
 * A listing's own view counter.
 *
 * Denormalized onto `pet_listings` rather than kept as a `pet_listing_views`
 * event table: the only question anyone asks is "how many", the owner's
 * listing screen reads it on every render, and a COUNT over an ever-growing
 * event table per row would be the expensive way to answer a number nobody
 * needs to slice by date yet. Add the event table alongside this if per-day
 * analytics ever become a requirement — the column stays correct either way.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_listings', 'view_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pet_listings', 'view_count');
  },
};
