'use strict';

/**
 * Pet types become rows, so an admin can add one without a deploy.
 *
 * They were a `varchar` written against a frozen `PetType` map in code:
 * adding "Turtle" meant editing constants, editing the seed, and shipping.
 * A table makes it an insert, and `is_active` makes retiring one a flag
 * rather than a delete that would orphan every listing under it.
 *
 * `value` stays the stable machine key ('DOG') and is unique; `label` is
 * display text an admin may reword freely. The existing `pet_type` columns
 * are left in place and kept in step — they are what every current query
 * and both apps read, and dropping them here would break the product
 * mid-migration for no gain. `pet_type_id` is the key new code uses.
 */
const TYPES = [
  ['DOG', 'Dog', 1],
  ['CAT', 'Cat', 2],
  ['BIRD', 'Bird', 3],
  ['FISH', 'Fish', 4],
  ['RABBIT', 'Rabbit', 5],
  ['GUINEA_PIG', 'Guinea Pig', 6],
  ['HAMSTER', 'Hamster', 7],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pet_types', {
      id: { type: Sequelize.CHAR(36), primaryKey: true, allowNull: false },
      value: { type: Sequelize.STRING(32), allowNull: false, unique: true },
      label: { type: Sequelize.STRING(120), allowNull: false },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.bulkInsert(
      'pet_types',
      TYPES.map(([value, label, order]) => ({
        id: crypto.randomUUID(),
        value,
        label,
        display_order: order,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    );

    for (const table of ['pet_listings', 'pet_attributes']) {
      await queryInterface.addColumn(table, 'pet_type_id', { type: Sequelize.CHAR(36), allowNull: true });
      // Backfilled by matching the existing string, so no listing loses its
      // type. Rows with a NULL pet_type (the common form sections) stay null.
      await queryInterface.sequelize.query(`
        UPDATE ${table} t JOIN pet_types pt ON pt.value = t.pet_type SET t.pet_type_id = pt.id
      `);
      await queryInterface.addConstraint(table, {
        fields: ['pet_type_id'],
        type: 'foreign key',
        name: `${table}_pet_type_id_fk`,
        references: { table: 'pet_types', field: 'id' },
        // A type in use cannot be deleted — retire it with `is_active`
        // instead, which is the whole point of that column.
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });
    }

    const [unmatched] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS missing FROM pet_listings WHERE pet_type IS NOT NULL AND pet_type_id IS NULL`
    );
    if (Number(unmatched[0].missing) > 0) {
      throw new Error(`${unmatched[0].missing} listings have a pet_type with no matching pet_types row.`);
    }
  },

  async down(queryInterface) {
    for (const table of ['pet_listings', 'pet_attributes']) {
      await queryInterface.removeConstraint(table, `${table}_pet_type_id_fk`);
      await queryInterface.removeColumn(table, 'pet_type_id');
    }
    await queryInterface.dropTable('pet_types');
  },
};
