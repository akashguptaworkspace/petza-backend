'use strict';

/**
 * Makes the option registry the actual source of truth for a listing's
 * choice values, so it can be edited from an admin panel without breaking
 * listings already published against it.
 *
 * Three parts, in this order for a reason:
 *
 * 1. Backfill values that drifted before anything enforced them. At the
 *    time of writing one listing carried breed `labrador` — a value in no
 *    option list, accepted because nothing checked — and colours were
 *    stored with inconsistent case ("Grey" beside "grey"). Both are fixed
 *    here rather than left for a validator to reject later, which would
 *    make those listings uneditable.
 *
 * 2. `is_active`, so an option can be retired without deleting it.
 *    Deleting one orphans every listing that used it; hiding it stops the
 *    form offering it while existing listings keep resolving their label.
 *
 * 3. `UNIQUE(attribute_id, value)`. This is what makes `value` a key an
 *    admin panel can rely on: `label` stays free to be reworded (fixing
 *    "Labrador Retreiver" is a one-row edit that breaks nothing), while
 *    `value` is the contract listings are written against and must be
 *    unambiguous within its attribute.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- 1. repair drifted data -------------------------------------------
    await queryInterface.sequelize.query(`
      UPDATE pet_listings SET breed = 'labrador-retriever' WHERE breed = 'labrador'
    `);

    // Every registered colour value is lower-case, so folding case here
    // lands on the canonical spelling. Going forward the write path maps to
    // whatever case the option actually carries, rather than assuming.
    await queryInterface.sequelize.query(`
      UPDATE pet_listings l
      JOIN (
        SELECT inner_l.id, JSON_ARRAYAGG(LOWER(jt.color)) AS fixed
        FROM pet_listings inner_l,
             JSON_TABLE(inner_l.colors, '$[*]' COLUMNS (color VARCHAR(64) PATH '$')) jt
        GROUP BY inner_l.id
      ) fixed_colors ON fixed_colors.id = l.id
      SET l.colors = fixed_colors.fixed
      WHERE JSON_LENGTH(l.colors) > 0
    `);

    // --- 2. retire instead of delete ---------------------------------------
    await queryInterface.addColumn('pet_attribute_options', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // --- 3. the value is the key -------------------------------------------
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT attribute_id, value, COUNT(*) AS copies
      FROM pet_attribute_options GROUP BY attribute_id, value HAVING copies > 1
    `);
    if (duplicates.length > 0) {
      const names = duplicates.map((row) => row.value).join(', ');
      throw new Error(
        `Cannot add UNIQUE(attribute_id, value): duplicate option values exist (${names}). Resolve them, then re-run.`
      );
    }

    await queryInterface.addConstraint('pet_attribute_options', {
      fields: ['attribute_id', 'value'],
      type: 'unique',
      name: 'pet_attribute_options_attribute_value_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('pet_attribute_options', 'pet_attribute_options_attribute_value_unique');
    await queryInterface.removeColumn('pet_attribute_options', 'is_active');
    // The backfill is deliberately not reversed: restoring a value that was
    // never valid would only recreate the drift.
  },
};
