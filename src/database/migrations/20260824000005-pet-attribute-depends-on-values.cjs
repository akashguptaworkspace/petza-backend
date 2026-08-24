'use strict';

/**
 * Widens a field's dependency from one value to a set.
 *
 * `depends_on_value` could only express "show this when the parent equals
 * X". Real conditions are rarely that narrow: the last-vaccination date is
 * worth asking of a fully *or* partially vaccinated pet, and meaningless
 * for the other two answers. Expressing that as equality would have meant
 * duplicating the field once per accepted answer.
 *
 * No data migration: `pet_attributes` is rebuilt wholesale from
 * `seed-data/pet-form-schema.cjs` on every seed, so the seeder repopulates
 * the new column. That is only true of this table — it holds definitions,
 * not anyone's data.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_attributes', 'depends_on_values', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.removeColumn('pet_attributes', 'depends_on_value');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('pet_attributes', 'depends_on_value', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.removeColumn('pet_attributes', 'depends_on_values');
  },
};
