import {
  PetAttributeSection,
  PetAttributeSectionLabel,
  PetAttributeSectionShortLabel,
  PetTypeLabel,
} from '../../config/constants.js';
import { petAttributeRepository } from '../../repositories/shared/petAttribute.repository.js';

/**
 * Render order of the form's steps. Not alphabetical and not the enum's
 * order — this is the order a partner fills them in.
 *
 * CATEGORY and AVAILABILITY are absent on purpose. They stay real scopes in
 * the database — that is what lets a field belong to dogs and not cats —
 * but neither is shipped as a step of its own. See `MERGED_INTO_INFORMATION`.
 */
const SECTION_ORDER = [
  PetAttributeSection.INFORMATION,
  PetAttributeSection.HEALTH,
  PetAttributeSection.MEDIA,
];

/**
 * Sections appended to INFORMATION instead of becoming steps, in the order
 * they are appended.
 *
 * CATEGORY, because "what kind of dog" is the same question as "what pet is
 * this" — splitting them made the partner answer half of one thing, move
 * on, and come back for the rest. AVAILABILITY, because three fields do not
 * earn a step of their own.
 *
 * Each contributes a `groupLabel` on its first field so the app can head
 * the run off without knowing which fields came from where.
 */
const MERGED_INTO_INFORMATION = [
  {
    section: PetAttributeSection.CATEGORY,
    groupLabel: (petType) => `${PetTypeLabel[petType] ?? 'Species'} details`,
  },
  {
    section: PetAttributeSection.AVAILABILITY,
    groupLabel: () => PetAttributeSectionLabel[PetAttributeSection.AVAILABILITY],
  },
];

/** Never return the model — this is the shape petza-partner's add-pet form reads. */
function toFieldDto(attribute) {
  return {
    key: attribute.key,
    label: attribute.label,
    inputType: attribute.inputType,
    isRequired: attribute.isRequired,
    isReadOnly: attribute.isReadOnly,
    /** The app appends its own "Other" choice and reveals a text box. The option list never contains it. */
    allowsOther: attribute.allowsOther,
    placeholder: attribute.placeholder,
    helpText: attribute.helpText,
    /** FILE/MEDIA only — how many the field accepts. Null everywhere else. */
    maxItems: attribute.maxItems,
    /** Presentation hint — 'INR' groups the number as currency while typing. Never changes what is stored. */
    format: attribute.format,
    /**
     * A sub-heading to draw above this field, marking where a run of
     * related fields starts. Null on all but the first of such a run. Only
     * the merged species fields use it today — see `getFormSchema`.
     */
    groupLabel: null,
    /**
     * Null unless the field is conditional. Shown when the field named by
     * `key` holds any of `values` — a set rather than one value, because
     * conditions like "fully *or* partially vaccinated" are the norm.
     * Compared as strings, so a BOOLEAN parent matches against ['true'].
     */
    dependsOn: attribute.dependsOnKey
      ? { key: attribute.dependsOnKey, values: attribute.dependsOnValues ?? [] }
      : null,
    options: (attribute.options ?? []).map((option) => ({ value: option.value, label: option.label })),
  };
}

export const petCatalogService = {
  /**
   * The add-pet form for one kind of animal.
   *
   * Called twice in a normal session: once with no `petType` to render the
   * first step (which is where the partner picks the type), then again with
   * their answer to pick up the species fields.
   *
   * The form is three steps — Information, Health, Photos. Species details
   * and pricing are folded into the first of them; see
   * `MERGED_INTO_INFORMATION` for why. Deciding that here rather than in
   * the app keeps it in one place instead of every client re-deciding it.
   *
   * A type with no CATEGORY rows — rabbit, fish, bird today — is not an
   * error. It gets the common questions and nothing extra, which is exactly
   * right: those animals are listable, they just have no species-specific
   * questions defined yet.
   */
  async getFormSchema(petType) {
    const attributes = await petAttributeRepository.findSchema(petType);

    const fieldsIn = (section) =>
      attributes.filter((attribute) => attribute.section === section).map(toFieldDto);

    const mergedFields = MERGED_INTO_INFORMATION.flatMap(({ section, groupLabel }) => {
      const fields = fieldsIn(section);
      // Marks where the run starts, so the app can head it off from the
      // fields above without knowing which came from where.
      if (fields.length) fields[0].groupLabel = groupLabel(petType);
      return fields;
    });

    const sections = SECTION_ORDER.map((section) => ({
      key: section,
      label: PetAttributeSectionLabel[section],
      /** For the wizard's step rail, where the full label doesn't fit. */
      shortLabel: PetAttributeSectionShortLabel[section],
      fields:
        section === PetAttributeSection.INFORMATION
          ? [...fieldsIn(section), ...mergedFields]
          : fieldsIn(section),
    })).filter((section) => section.fields.length > 0);

    return {
      petType: petType ?? null,
      /** True once the response carries species-specific questions — they are inside INFORMATION, not a step of their own. */
      hasCategorySection: attributes.some((attribute) => attribute.section === PetAttributeSection.CATEGORY),
      sections,
    };
  },
};
