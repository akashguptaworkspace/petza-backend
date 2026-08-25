'use strict';

/**
 * A listing's own city.
 *
 * Store listings take their location from the store, and still do — the
 * form deliberately never asked for one, precisely so the two couldn't
 * drift. That reasoning only ever covered partners: an individual has no
 * store to inherit from, so their listings had no location at all and every
 * card rendered without one.
 *
 * Nullable, and read as `listing.city ?? store.city`: a partner listing
 * leaves it null and keeps inheriting, an individual listing carries its
 * own. Nothing about the store path changes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_listings', 'city', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pet_listings', 'city');
  },
};
