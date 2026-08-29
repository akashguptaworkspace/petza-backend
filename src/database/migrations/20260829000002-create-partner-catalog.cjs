'use strict';

/**
 * The taxonomy partners choose from, and the dynamic form fields each
 * choice pulls in — PRODUCT_CONTEXT.md §4 and §5.
 *
 * Both tables are admin-owned: partners only ever *select* from them, and
 * the partner app hardcodes no category list, so a new tag or a new field
 * on an existing tag ships by inserting a row, not by releasing an app
 * (§10).
 *
 * One table holds both taxonomies, split by `listing_type`:
 *
 *   PRODUCT — one parent, "Accessories", with ~14 children used purely as
 *             selectable tags. Deliberately not a browsable tree; the
 *             children exist to key form fields and search filters.
 *   SERVICE — seven flat top-level categories, no children, because each
 *             one has a materially different booking form.
 *
 * `requires_verification` is what gates Medicines, Supplements and
 * Veterinary behind a document check before a listing under them can go
 * live.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      listing_type: { type: Sequelize.ENUM('PRODUCT', 'SERVICE'), allowNull: false },
      // Self-referencing: null for a top-level category, set for a product
      // tag hanging off Accessories. ON DELETE CASCADE would take a whole
      // taxonomy branch with it, so deleting a parent is blocked instead —
      // admin deactivates (`is_active`) rather than deletes.
      parent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      /** Names an icon in the app's own set — never a component name, so the two can restyle independently. */
      icon_key: { type: Sequelize.STRING, allowNull: true },
      requires_verification: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // The one query the category pickers run: "active categories of this
    // type, in the order admin arranged them".
    await queryInterface.addIndex('categories', ['listing_type', 'is_active', 'sort_order'], {
      name: 'categories_type_active_sort',
    });
    await queryInterface.addIndex('categories', ['parent_id'], { name: 'categories_parent_id' });

    await queryInterface.createTable('category_attributes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /**
       * The stable key this field's answer is stored under inside a
       * listing's `attributes` JSON. Separate from `attribute_name` so
       * admin can reword a label ("Weight" → "Net weight") without
       * orphaning the answers already saved against it.
       */
      attribute_key: { type: Sequelize.STRING(80), allowNull: false },
      /** The human label rendered above the field. */
      attribute_name: { type: Sequelize.STRING, allowNull: false },
      attribute_type: {
        type: Sequelize.ENUM('SELECT', 'MULTISELECT', 'NUMBER', 'TEXT', 'BOOLEAN'),
        allowNull: false,
      },
      /** Array of `{ value, label }`. Null for every type except SELECT/MULTISELECT. */
      options: { type: Sequelize.JSON, allowNull: true },
      /** Placeholder / helper copy, so the form needs no per-field code in the app. */
      hint: { type: Sequelize.STRING, allowNull: true },
      /** Appended after the input — "kg", "ml", "months". */
      unit: { type: Sequelize.STRING(24), allowNull: true },
      is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Two fields in one category can't share a key — they would overwrite
    // each other in the listing's attributes blob.
    await queryInterface.addIndex('category_attributes', ['category_id', 'attribute_key'], {
      name: 'category_attributes_category_key',
      unique: true,
    });
    await queryInterface.addIndex('category_attributes', ['category_id', 'sort_order'], {
      name: 'category_attributes_category_sort',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('category_attributes');
    await queryInterface.dropTable('categories');
  },
};
