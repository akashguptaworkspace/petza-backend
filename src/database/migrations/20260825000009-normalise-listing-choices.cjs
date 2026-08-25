'use strict';

/**
 * Every choice a listing holds becomes a reference to the option row it
 * came from, so an admin can rename, retire or reorder options without
 * touching listings.
 *
 * Three shapes, because the answers have three shapes:
 *
 * - `breed_option_id` — one column, because a listing has one breed. The
 *   free-text `breed_other` stays exactly as it is: it exists for values
 *   that are deliberately NOT in the registry, so it has nothing to point at.
 * - `pet_listing_colors` — a join table, because colours are many per
 *   listing. This also makes colour filterable with an index, which the JSON
 *   array never was.
 * - `pet_listing_attribute_values` — the long tail. Each answer becomes a
 *   row keyed by `attribute_id`, so renaming an attribute's `key` in admin
 *   no longer strands every listing's JSON blob, which was keyed by that
 *   string. Choice answers carry `option_id`; everything else lands in the
 *   typed value column that fits it.
 *
 * The legacy `breed`, `colors` and `attributes` columns are KEPT and kept in
 * step. Both apps read them today, and the DTO now returns ids alongside
 * them — dropping them here would break the product mid-migration to save
 * nothing. They become derived data; the ids are the truth.
 *
 * Every id column below is declared `utf8mb4_bin` explicitly. The UUID
 * primary keys they reference carry that collation, while a bare CHAR(36)
 * inherits the table default (`utf8mb4_0900_ai_ci`) — and MySQL rejects a
 * foreign key between columns whose collations differ, with a message that
 * says only "incompatible".
 */
const UUID_COLUMN = 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * The driver connects with `utf8mb4_unicode_ci`, so every string LITERAL
     * in the raw SQL below carries that collation while the columns it is
     * compared against carry the schema's `utf8mb4_0900_ai_ci`. MySQL
     * refuses the comparison outright — "illegal mix of collations" — even
     * though both sides hold the same text.
     *
     * Sequelize's own generated queries are unaffected because they bind
     * parameters rather than inlining literals; only hand-written SQL like
     * this hits it. Aligning the session fixes every comparison here at once.
     *
     * Read from the database rather than hardcoded, because the collation is
     * not the same everywhere: this project's local schema is
     * `utf8mb4_unicode_ci` and its remote one `utf8mb4_0900_ai_ci`. Pinning
     * either value made the migration pass on one and fail on the other,
     * which is exactly the dev/prod divergence migrations exist to prevent.
     */
    const [[schema]] = await queryInterface.sequelize.query(
      `SELECT DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()`
    );
    await queryInterface.sequelize.query(`SET NAMES utf8mb4 COLLATE ${schema.collation}`);

    // ---- breed ------------------------------------------------------------
    await queryInterface.sequelize.query(
      `ALTER TABLE pet_listings ADD COLUMN breed_option_id ${UUID_COLUMN} NULL`
    );

    // Matched within the listing's own pet type: `breed` is not unique
    // across types on its own (a value could exist for both DOG and CAT),
    // so the type is part of the key.
    await queryInterface.sequelize.query(`
      UPDATE pet_listings l
      JOIN pet_attributes a ON a.\`key\` = 'breed' AND a.pet_type = l.pet_type
      JOIN pet_attribute_options o ON o.attribute_id = a.id AND o.value = l.breed
      SET l.breed_option_id = o.id
      WHERE l.breed IS NOT NULL
    `);

    await queryInterface.addConstraint('pet_listings', {
      fields: ['breed_option_id'],
      type: 'foreign key',
      name: 'pet_listings_breed_option_id_fk',
      references: { table: 'pet_attribute_options', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // ---- colours ----------------------------------------------------------
    await queryInterface.createTable('pet_listing_colors', {
      id: { type: UUID_COLUMN, primaryKey: true, allowNull: false },
      pet_listing_id: { type: UUID_COLUMN, allowNull: false },
      option_id: { type: UUID_COLUMN, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('pet_listing_colors', {
      fields: ['pet_listing_id', 'option_id'],
      type: 'unique',
      name: 'pet_listing_colors_unique',
    });
    await queryInterface.addConstraint('pet_listing_colors', {
      fields: ['pet_listing_id'],
      type: 'foreign key',
      name: 'pet_listing_colors_listing_fk',
      references: { table: 'pet_listings', field: 'id' },
      // Colours belong to the listing; deleting one takes them with it.
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('pet_listing_colors', {
      fields: ['option_id'],
      type: 'foreign key',
      name: 'pet_listing_colors_option_fk',
      references: { table: 'pet_attribute_options', field: 'id' },
      onDelete: 'RESTRICT',
    });

    await queryInterface.sequelize.query(`
      INSERT INTO pet_listing_colors (id, pet_listing_id, option_id, created_at, updated_at)
      SELECT UUID(), l.id, o.id, NOW(), NOW()
      FROM pet_listings l
      JOIN JSON_TABLE(l.colors, '$[*]' COLUMNS (color VARCHAR(64) PATH '$')) jt
      JOIN pet_attributes a ON a.\`key\` = 'colors'
      JOIN pet_attribute_options o ON o.attribute_id = a.id AND o.value = jt.color
      WHERE JSON_LENGTH(l.colors) > 0
    `);

    // ---- the long tail ----------------------------------------------------
    await queryInterface.createTable('pet_listing_attribute_values', {
      id: { type: UUID_COLUMN, primaryKey: true, allowNull: false },
      pet_listing_id: { type: UUID_COLUMN, allowNull: false },
      attribute_id: { type: UUID_COLUMN, allowNull: false },
      /** Set on SELECT / MULTI_SELECT answers. A multi-select is several rows. */
      option_id: { type: UUID_COLUMN, allowNull: true },
      value_text: { type: Sequelize.TEXT, allowNull: true },
      value_number: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      value_boolean: { type: Sequelize.BOOLEAN, allowNull: true },
      value_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('pet_listing_attribute_values', {
      fields: ['pet_listing_id'],
      type: 'foreign key',
      name: 'pet_listing_attribute_values_listing_fk',
      references: { table: 'pet_listings', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('pet_listing_attribute_values', {
      fields: ['attribute_id'],
      type: 'foreign key',
      name: 'pet_listing_attribute_values_attribute_fk',
      references: { table: 'pet_attributes', field: 'id' },
      // An attribute with answers stored against it cannot be deleted —
      // retire it instead, or those answers lose their meaning entirely.
      onDelete: 'RESTRICT',
    });
    await queryInterface.addConstraint('pet_listing_attribute_values', {
      fields: ['option_id'],
      type: 'foreign key',
      name: 'pet_listing_attribute_values_option_fk',
      references: { table: 'pet_attribute_options', field: 'id' },
      onDelete: 'RESTRICT',
    });
    await queryInterface.addIndex('pet_listing_attribute_values', ['pet_listing_id', 'attribute_id'], {
      name: 'pet_listing_attribute_values_listing_attribute_idx',
    });

    /**
     * Backfill, in two passes because the JSON holds two shapes.
     *
     * `attributes` is an object, so keys come from `JSON_KEYS` rather than
     * iterating the document — `JSON_TABLE(doc, '$[*]')` walks an array and
     * finds nothing in an object. Each comparison carries an explicit
     * COLLATE: the values `JSON_UNQUOTE` produces take the connection's
     * collation, which is not the column's, and MySQL refuses the join with
     * a bare "illegal mix of collations".
     *
     * A value that matches an option becomes `option_id`; anything else is
     * stored in the typed column its JSON type calls for. Nothing is
     * dropped — an answer with no matching option is still an answer.
     */
    const ATTR_JSON = `JSON_EXTRACT(l.attributes, CONCAT('$."', k.attr_key, '"'))`;

    // Pass 1 — one answer per key.
    await queryInterface.sequelize.query(`
      INSERT INTO pet_listing_attribute_values
        (id, pet_listing_id, attribute_id, option_id, value_text, value_number, value_boolean, created_at, updated_at)
      SELECT UUID(), l.id, a.id, o.id,
             CASE WHEN o.id IS NULL AND JSON_TYPE(${ATTR_JSON}) IN ('STRING', 'NULL')
                  THEN JSON_UNQUOTE(${ATTR_JSON}) END,
             CASE WHEN JSON_TYPE(${ATTR_JSON}) IN ('INTEGER', 'DOUBLE', 'DECIMAL')
                  THEN JSON_UNQUOTE(${ATTR_JSON}) END,
             CASE WHEN JSON_TYPE(${ATTR_JSON}) = 'BOOLEAN'
                  THEN JSON_UNQUOTE(${ATTR_JSON}) = 'true' END,
             NOW(), NOW()
      FROM pet_listings l
      JOIN JSON_TABLE(JSON_KEYS(l.attributes), '$[*]' COLUMNS (attr_key VARCHAR(64) PATH '$')) k
      JOIN pet_attributes a
        ON a.\`key\` = k.attr_key COLLATE ${schema.collation}
       AND (a.pet_type = l.pet_type OR a.pet_type IS NULL)
      LEFT JOIN pet_attribute_options o
        ON o.attribute_id = a.id
       AND o.value = JSON_UNQUOTE(${ATTR_JSON}) COLLATE ${schema.collation}
      WHERE JSON_LENGTH(l.attributes) > 0
        AND JSON_TYPE(${ATTR_JSON}) <> 'ARRAY'
    `);

    // Pass 2 — a multi-select is one row per chosen element.
    await queryInterface.sequelize.query(`
      INSERT INTO pet_listing_attribute_values
        (id, pet_listing_id, attribute_id, option_id, value_text, created_at, updated_at)
      SELECT UUID(), l.id, a.id, o.id,
             CASE WHEN o.id IS NULL THEN elem.item END,
             NOW(), NOW()
      FROM pet_listings l
      JOIN JSON_TABLE(JSON_KEYS(l.attributes), '$[*]' COLUMNS (attr_key VARCHAR(64) PATH '$')) k
      JOIN JSON_TABLE(${ATTR_JSON}, '$[*]' COLUMNS (item VARCHAR(120) PATH '$')) elem
      JOIN pet_attributes a
        ON a.\`key\` = k.attr_key COLLATE ${schema.collation}
       AND (a.pet_type = l.pet_type OR a.pet_type IS NULL)
      LEFT JOIN pet_attribute_options o
        ON o.attribute_id = a.id AND o.value = elem.item COLLATE ${schema.collation}
      WHERE JSON_LENGTH(l.attributes) > 0
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pet_listing_attribute_values');
    await queryInterface.dropTable('pet_listing_colors');
    await queryInterface.removeConstraint('pet_listings', 'pet_listings_breed_option_id_fk');
    await queryInterface.removeColumn('pet_listings', 'breed_option_id');
  },
};
