'use strict';

/**
 * The add-pet form, stored as data.
 *
 * Rather than a column per question on a pets table (and a matching field
 * hardcoded in the partner app), the *questions themselves* are rows. A
 * field belongs either to every listing (`pet_type` null) or to one kind of
 * animal (`pet_type` = 'DOG'), and the app asks the server what to render
 * once the partner picks a type.
 *
 * The point is what it costs to support cats, or to add "microchipped?" to
 * dogs: rows in a seed file, no migration, no app release, and every client
 * — partner app, customer filters, admin moderation — sees the change at
 * once. The trade is that nothing here is type-checked at compile time;
 * `pet_attributes.key` is the contract, so renaming one is a data
 * migration exactly like renaming a column would be.
 *
 * Answers are not stored here — this is the questionnaire, not the
 * responses. Those land on the pet listing itself when that table exists.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pet_attributes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      /**
       * NULL means "asked of every pet". A value scopes the field to that
       * animal, which is what makes the CATEGORY section differ per type.
       * Deliberately a STRING rather than an ENUM: adding a pet type should
       * be a seed change, not an ALTER TABLE.
       */
      pet_type: { type: Sequelize.STRING(32), allowNull: true },
      section: {
        type: Sequelize.ENUM('INFORMATION', 'HEALTH', 'CATEGORY', 'AVAILABILITY', 'MEDIA'),
        allowNull: false,
      },
      /** The stable identifier a stored answer refers to. Renaming one is a data migration. */
      key: { type: Sequelize.STRING(64), allowNull: false },
      label: { type: Sequelize.STRING(120), allowNull: false },
      input_type: {
        type: Sequelize.ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE', 'MEDIA'),
        allowNull: false,
      },
      is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      /** The app derives this value and shows it read-only — age from date of birth. */
      is_read_only: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      /**
       * Whether picking "Other" reveals a free-text box. Keeps a breed list
       * curated without blocking the one shopkeeper whose dog isn't on it.
       */
      allows_other: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      placeholder: { type: Sequelize.STRING(160), allowNull: true },
      help_text: { type: Sequelize.STRING(240), allowNull: true },
      /**
       * Conditional display: this field is hidden until the field named by
       * `depends_on_key` holds `depends_on_value`. That's how "Father's
       * name" stays out of the way until the partner says they have the
       * father's details. Compared as a string, so a BOOLEAN parent uses
       * 'true'.
       */
      depends_on_key: { type: Sequelize.STRING(64), allowNull: true },
      depends_on_value: { type: Sequelize.STRING(64), allowNull: true },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // A key is unique *within* its scope: `breed` exists for DOG and again
    // for CAT with different options, and must not collide.
    await queryInterface.addIndex('pet_attributes', ['pet_type', 'key'], {
      name: 'pet_attributes_pet_type_key',
      unique: true,
    });

    // The only read this table gets: "the common fields plus this one
    // animal's, in display order".
    await queryInterface.addIndex('pet_attributes', ['pet_type', 'section', 'display_order'], {
      name: 'pet_attributes_pet_type_section_order',
    });

    await queryInterface.createTable('pet_attribute_options', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pet_attributes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** What gets stored on the listing. Slug-cased and permanent; the label above it is free to be reworded. */
      value: { type: Sequelize.STRING(64), allowNull: false },
      label: { type: Sequelize.STRING(120), allowNull: false },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('pet_attribute_options', ['attribute_id', 'value'], {
      name: 'pet_attribute_options_attribute_value',
      unique: true,
    });
    await queryInterface.addIndex('pet_attribute_options', ['attribute_id', 'display_order'], {
      name: 'pet_attribute_options_attribute_order',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pet_attribute_options');
    await queryInterface.dropTable('pet_attributes');
  },
};
