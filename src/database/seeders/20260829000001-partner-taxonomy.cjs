'use strict';

const { v4: uuidv4 } = require('uuid');

const { PRODUCT_ROOT, PRODUCT_TAGS, SERVICE_CATEGORIES } = require('../seed-data/partner-taxonomy.cjs');

/**
 * Inserts the starting taxonomy from `seed-data/partner-taxonomy.cjs` —
 * PRODUCT_CONTEXT.md §4.
 *
 * Idempotent by slug, matching the other seeders here: it looks up what
 * already exists and inserts only what is missing, because
 * `POST /system/seed` runs it against databases that have been seeded
 * before. Re-running it will not duplicate a category, and — importantly —
 * will not *overwrite* one an admin has since edited through the Catalog
 * screens. The seed is the initial state, not the enforced state.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const { sequelize } = queryInterface;

    const [existingRows] = await sequelize.query('SELECT slug FROM categories');
    const existingSlugs = new Set(existingRows.map((row) => row.slug));

    const categories = [];
    const attributes = [];

    /** Flattens one entry's compact attribute list into `category_attributes` rows. */
    const pushAttributes = (categoryId, list) => {
      list.forEach((attribute, index) => {
        attributes.push({
          id: uuidv4(),
          category_id: categoryId,
          attribute_key: attribute.key,
          attribute_name: attribute.label,
          attribute_type: attribute.type,
          // Stored as `[{ value, label }]` so a label can be reworded
          // later without invalidating answers already saved against the
          // value. Seeded with the two identical, which is fine — the
          // value is what listings persist.
          options: attribute.options
            ? JSON.stringify(attribute.options.map((option) => ({ value: option, label: option })))
            : null,
          hint: attribute.hint ?? null,
          unit: attribute.unit ?? null,
          is_required: Boolean(attribute.required),
          sort_order: index,
          created_at: now,
          updated_at: now,
        });
      });
    };

    // The product root has to exist before its tags, which reference it.
    let productRootId;
    if (existingSlugs.has(PRODUCT_ROOT.slug)) {
      const [[row]] = await sequelize.query('SELECT id FROM categories WHERE slug = :slug', {
        replacements: { slug: PRODUCT_ROOT.slug },
      });
      productRootId = row.id;
    } else {
      productRootId = uuidv4();
      categories.push({
        id: productRootId,
        name: PRODUCT_ROOT.name,
        slug: PRODUCT_ROOT.slug,
        listing_type: 'PRODUCT',
        parent_id: null,
        icon_key: PRODUCT_ROOT.icon,
        requires_verification: false,
        is_active: true,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      });
    }

    PRODUCT_TAGS.forEach((tag, index) => {
      if (existingSlugs.has(tag.slug)) return;
      const id = uuidv4();
      categories.push({
        id,
        name: tag.name,
        slug: tag.slug,
        listing_type: 'PRODUCT',
        parent_id: productRootId,
        icon_key: tag.icon,
        requires_verification: Boolean(tag.requiresVerification),
        is_active: true,
        sort_order: index,
        created_at: now,
        updated_at: now,
      });
      pushAttributes(id, tag.attributes);
    });

    SERVICE_CATEGORIES.forEach((category, index) => {
      if (existingSlugs.has(category.slug)) return;
      const id = uuidv4();
      categories.push({
        id,
        name: category.name,
        slug: category.slug,
        listing_type: 'SERVICE',
        parent_id: null,
        icon_key: category.icon,
        requires_verification: Boolean(category.requiresVerification),
        is_active: true,
        sort_order: index,
        created_at: now,
        updated_at: now,
      });
      pushAttributes(id, category.attributes);
    });

    if (categories.length) await queryInterface.bulkInsert('categories', categories);
    if (attributes.length) await queryInterface.bulkInsert('category_attributes', attributes);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const slugs = [PRODUCT_ROOT.slug, ...PRODUCT_TAGS.map((t) => t.slug), ...SERVICE_CATEGORIES.map((c) => c.slug)];

    // Attributes go first — they hold the foreign key. Tags before the
    // root, since `parent_id` is ON DELETE RESTRICT.
    await sequelize.query(
      'DELETE FROM category_attributes WHERE category_id IN (SELECT id FROM categories WHERE slug IN (:slugs))',
      { replacements: { slugs } }
    );
    await sequelize.query('DELETE FROM categories WHERE slug IN (:slugs) AND parent_id IS NOT NULL', {
      replacements: { slugs },
    });
    await sequelize.query('DELETE FROM categories WHERE slug IN (:slugs)', { replacements: { slugs } });
  },
};
