'use strict';

const { v4: uuidv4 } = require('uuid');

const { PET_FORM_SCHEMA } = require('../seed-data/pet-form-schema.cjs');

/**
 * Publishes `seed-data/pet-form-schema.cjs` into the database.
 *
 * Idempotent by design, because this is not a one-off fixture — it is how a
 * change to the form ships. Adding a breed means editing that file and
 * re-running this seeder; nothing else moves. So it upserts each attribute
 * by its (pet_type, key) identity, replaces that attribute's option rows,
 * and prunes attributes the file no longer defines — rather than assuming
 * an empty table.
 *
 * Options are replaced wholesale rather than diffed. That's safe because an
 * option's `value` is stable and a listing stores the value, not a row id —
 * so deleting and re-inserting the same option does not orphan anything.
 *
 * `down` removes only the attributes this file defines, leaving any added
 * by hand alone.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const group of PET_FORM_SCHEMA) {
      for (const [index, field] of group.fields.entries()) {
        const petTypeClause = group.petType === null ? 'pet_type IS NULL' : 'pet_type = :petType';

        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM pet_attributes WHERE ${petTypeClause} AND \`key\` = :key LIMIT 1`,
          {
            replacements: { petType: group.petType, key: field.key },
            type: queryInterface.sequelize.QueryTypes.SELECT,
          }
        );

        const values = {
          pet_type: group.petType,
          section: group.section,
          key: field.key,
          label: field.label,
          input_type: field.inputType,
          is_required: field.isRequired ?? false,
          is_read_only: field.isReadOnly ?? false,
          allows_other: field.allowsOther ?? false,
          placeholder: field.placeholder ?? null,
          help_text: field.helpText ?? null,
          depends_on_key: field.dependsOnKey ?? null,
          // bulkInsert/bulkUpdate don't serialise a JS array into a JSON
          // column on their own — they hand it to the driver as-is.
          depends_on_values: field.dependsOnValues ? JSON.stringify(field.dependsOnValues) : null,
          max_items: field.maxItems ?? null,
          format: field.format ?? null,
          display_order: index,
          updated_at: now,
        };

        let attributeId;

        if (existing) {
          attributeId = existing.id;
          await queryInterface.bulkUpdate('pet_attributes', values, { id: attributeId });
          await queryInterface.bulkDelete('pet_attribute_options', { attribute_id: attributeId });
        } else {
          attributeId = uuidv4();
          await queryInterface.bulkInsert('pet_attributes', [{ id: attributeId, ...values, created_at: now }]);
        }

        if (field.options?.length) {
          await queryInterface.bulkInsert(
            'pet_attribute_options',
            field.options.map((option) => ({
              id: uuidv4(),
              attribute_id: attributeId,
              value: option.value,
              label: option.label,
              display_order: option.displayOrder,
              created_at: now,
              updated_at: now,
            }))
          );
        }
      }
    }

    // Drop attributes that were deleted from the file. Upserting alone is
    // not enough for "edit the file and re-run" to be true: without this,
    // removing a question leaves it live in the database and the app keeps
    // asking it.
    //
    // Scoped to the pet types this file actually defines, so rows added out
    // of band for an animal it says nothing about are left alone.
    const scopes = [...new Set(PET_FORM_SCHEMA.map((group) => group.petType))];

    for (const scope of scopes) {
      const keys = PET_FORM_SCHEMA.filter((group) => group.petType === scope).flatMap((group) =>
        group.fields.map((field) => field.key)
      );
      if (!keys.length) continue;

      const petTypeClause = scope === null ? 'pet_type IS NULL' : 'pet_type = :petType';
      await queryInterface.sequelize.query(
        `DELETE FROM pet_attributes WHERE ${petTypeClause} AND \`key\` NOT IN (:keys)`,
        { replacements: { petType: scope, keys } }
      );
    }
  },

  async down(queryInterface) {
    for (const group of PET_FORM_SCHEMA) {
      const keys = group.fields.map((field) => field.key);
      const petTypeClause = group.petType === null ? 'pet_type IS NULL' : 'pet_type = :petType';

      // Options go with their attribute via ON DELETE CASCADE.
      await queryInterface.sequelize.query(
        `DELETE FROM pet_attributes WHERE ${petTypeClause} AND \`key\` IN (:keys)`,
        { replacements: { petType: group.petType, keys } }
      );
    }
  },
};
