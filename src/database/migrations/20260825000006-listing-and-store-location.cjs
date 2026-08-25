'use strict';

/**
 * Full location on a listing, and on a store.
 *
 * A city alone can't answer "show me pets in Bihar" — the browse feed opens
 * on the user's STATE so a small town isn't an empty screen, and narrows to
 * a city only when they ask for one. Storing both means neither question
 * needs a lookup table of which city sits in which state.
 *
 * `pincode` and the coordinates are captured at the same time because the
 * same reverse-geocode call already returns them: writing them now costs
 * nothing and is the only chance to record where the pet actually was.
 * Nothing reads the coordinates yet — distance sorting is what they exist
 * for, and `Pet.distanceInKm` has been null on every real listing until now.
 *
 * Stores get the same four columns so a partner listing keeps inheriting
 * its store's location rather than carrying a second copy that can drift —
 * exactly the rule the city column already follows.
 */
const LOCATION_COLUMNS = (Sequelize) => ({
  state: { type: Sequelize.STRING(120), allowNull: true },
  pincode: { type: Sequelize.STRING(12), allowNull: true },
  latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
  longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = LOCATION_COLUMNS(Sequelize);

    for (const [name, spec] of Object.entries(columns)) {
      await queryInterface.addColumn('pet_listings', name, spec);
    }

    // `city` already exists on pet_listings; stores need it kept as-is and
    // only gain the three it lacks plus state.
    for (const [name, spec] of Object.entries(columns)) {
      await queryInterface.addColumn('stores', name, spec);
    }

    // Both filters run on equality against these, on every catalogue read.
    await queryInterface.addIndex('pet_listings', ['state'], { name: 'pet_listings_state_idx' });
    await queryInterface.addIndex('pet_listings', ['city'], { name: 'pet_listings_city_idx' });
    await queryInterface.addIndex('stores', ['state'], { name: 'stores_state_idx' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('stores', 'stores_state_idx');
    await queryInterface.removeIndex('pet_listings', 'pet_listings_city_idx');
    await queryInterface.removeIndex('pet_listings', 'pet_listings_state_idx');

    for (const name of Object.keys(LOCATION_COLUMNS(Sequelize))) {
      await queryInterface.removeColumn('stores', name);
      await queryInterface.removeColumn('pet_listings', name);
    }
  },
};
