'use strict';

/**
 * ⭐ The add-pet form, in one file.
 *
 * This is the master list. Every dropdown the partner app shows while
 * creating a listing — pet types, breeds, coats, temperaments, health
 * states, price types — is defined here and nowhere else, then seeded into
 * `pet_attributes` / `pet_attribute_options` and served to the app.
 *
 * ## Adding to it
 *
 * A new option (one more breed): add the string, re-run the seeder.
 * A new question (say "Microchipped?" for dogs): add an entry to
 * `DOG_CATEGORY`, re-run the seeder.
 * A new animal: add its `PetType`, add a `<TYPE>_CATEGORY` array, append it
 * below. CAT exists as the worked example of exactly that.
 *
 * None of those need a migration or an app release. The seeder is
 * idempotent — it upserts by (petType, key) and replaces that attribute's
 * options — so re-running it is how you publish a change.
 *
 * ## Rules
 *
 * - `key` and option `value` are **permanent**. They are what a saved
 *   listing points at, so renaming one is a data migration. `label` is
 *   display text and can be reworded freely.
 * - `allowsOther: true` means the app appends its own "Other" choice and
 *   reveals a text box. Do **not** also list "Other" as an option — that
 *   would render it twice.
 * - Fields with a null `petType` are asked of every listing. Only the
 *   CATEGORY section is per-animal.
 */

/** "Labrador Retriever" → "labrador-retriever". */
function slug(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Turns labels into ordered options. Pass a string to derive the stored
 * value from the label, or `[value, label]` to pin a value that must match
 * something else — the pet types below pin theirs to the `PetType` enum,
 * since that answer is what the app sends back to fetch the next section.
 */
function options(...entries) {
  return entries.map((entry, index) =>
    Array.isArray(entry)
      ? { value: entry[0], label: entry[1], displayOrder: index }
      : { value: slug(entry), label: entry, displayOrder: index }
  );
}

// ---------------------------------------------------------------------------
// Shared option sets
// ---------------------------------------------------------------------------

/** Reused by the dog's own breed and by its parents' breeds. */
const DOG_BREEDS = options(
  'Labrador Retriever',
  'Golden Retriever',
  'German Shepherd',
  'Rottweiler',
  'Beagle',
  'Pug',
  'Pomeranian',
  'Shih Tzu',
  'Chihuahua',
  'Dachshund',
  'Siberian Husky',
  'Great Dane',
  'Doberman',
  'Boxer',
  'French Bulldog',
  'Cocker Spaniel',
  'Indian Pariah / Indie',
  'Rajapalayam',
  'Mudhol Hound',
  'Chippiparai',
  'Kombai'
);

const CAT_BREEDS = options(
  'Persian',
  'Siamese',
  'Maine Coon',
  'Bengal',
  'Ragdoll',
  'British Shorthair',
  'Russian Blue',
  'Scottish Fold',
  'Abyssinian',
  'Himalayan',
  'Sphynx',
  'Indian Domestic Shorthair'
);

/** Coat and eye colours, shared by the pet and its parents. */
const COLORS = options(
  'Black',
  'White',
  'Brown',
  'Golden',
  'Cream',
  'Grey',
  'Fawn',
  'Brindle',
  'Tri Colour',
  'Black & Tan',
  'Merle',
  'Multi Colour'
);

// ---------------------------------------------------------------------------
// Common sections — asked of every listing, whatever the animal
// ---------------------------------------------------------------------------

const COMMON_INFORMATION = [
  {
    key: 'name',
    label: 'Pet Name',
    inputType: 'TEXT',
    isRequired: true,
    placeholder: 'Enter pet name',
  },
  {
    key: 'petType',
    label: 'Pet Type',
    inputType: 'SELECT',
    isRequired: true,
    placeholder: 'Select pet type',
    helpText: 'Choosing this decides which extra details are asked further down.',
    // Values pinned to the PetType enum: this answer is what the app sends
    // back as ?petType= to fetch the matching CATEGORY section.
    options: options(
      ['DOG', 'Dog'],
      ['CAT', 'Cat'],
      ['RABBIT', 'Rabbit'],
      ['HAMSTER', 'Hamster'],
      ['GUINEA_PIG', 'Guinea Pig'],
      ['FISH', 'Fish'],
      ['BIRD', 'Bird']
    ),
  },
  {
    key: 'gender',
    label: 'Gender',
    inputType: 'SELECT',
    isRequired: true,
    placeholder: 'Select gender',
    options: options('Male', 'Female'),
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    inputType: 'DATE',
    placeholder: 'Select date',
  },
  {
    key: 'age',
    label: 'Age',
    inputType: 'TEXT',
    isRequired: true,
    isReadOnly: true,
    placeholder: 'Auto-calculated',
    helpText: 'Age is calculated from the date of birth.',
  },
  {
    key: 'colors',
    label: 'Color',
    inputType: 'MULTI_SELECT',
    placeholder: 'Select colors',
    options: COLORS,
  },
  {
    key: 'size',
    label: 'Size',
    inputType: 'SELECT',
    placeholder: 'Select size',
    options: options('Small', 'Medium', 'Large', 'Extra Large'),
  },
  {
    key: 'weightKg',
    label: 'Weight (kg)',
    inputType: 'NUMBER',
    placeholder: 'Enter weight',
  },
  {
    key: 'description',
    label: 'Description',
    inputType: 'TEXTAREA',
    placeholder: 'Describe this pet for buyers',
  },
];

const COMMON_HEALTH = [
  {
    key: 'healthStatus',
    label: 'Health Condition',
    inputType: 'SELECT',
    isRequired: true,
    allowsOther: true,
    placeholder: 'Select health condition',
    options: options('Healthy', 'Under Treatment', 'Special Care Required'),
  },
  {
    key: 'vaccinationStatus',
    label: 'Vaccination Status',
    inputType: 'SELECT',
    isRequired: true,
    placeholder: 'Select vaccination status',
    options: options('Fully Vaccinated', 'Partially Vaccinated', 'Not Vaccinated', 'Not Applicable'),
  },
  // Both only make sense for a pet that has actually had a shot. "Not
  // vaccinated" and "Not applicable" have no date and no certificate, so
  // asking would be asking for something that cannot exist.
  {
    key: 'lastVaccinationDate',
    label: 'Last Vaccination Date',
    inputType: 'DATE',
    placeholder: 'Select date',
    dependsOnKey: 'vaccinationStatus',
    dependsOnValues: ['fully-vaccinated', 'partially-vaccinated'],
  },
  {
    key: 'vaccinationCertificate',
    label: 'Vaccination Certificate',
    inputType: 'FILE',
    maxItems: 1,
    dependsOnKey: 'vaccinationStatus',
    dependsOnValues: ['fully-vaccinated', 'partially-vaccinated'],
  },
  {
    key: 'hasMedicalCondition',
    label: 'Any Medical Condition?',
    inputType: 'BOOLEAN',
  },
  {
    key: 'medicalCondition',
    label: 'Condition',
    inputType: 'SELECT',
    allowsOther: true,
    placeholder: 'Select condition',
    dependsOnKey: 'hasMedicalCondition',
    dependsOnValues: ['true'],
    options: options(
      'Allergies',
      'Skin Condition',
      'Eye Condition',
      'Ear Infection',
      'Hip Dysplasia',
      'Digestive Issue',
      'Respiratory Issue',
      'Recovering from Injury'
    ),
  },
  {
    key: 'healthNotes',
    label: 'Health Notes',
    inputType: 'TEXTAREA',
    placeholder: 'Anything a buyer should know',
  },
];

// Availability status is deliberately not asked here. A listing being
// created is by definition available — the partner would only ever pick the
// one answer — so the server sets AVAILABLE on create and the status
// changes later through the listing's own actions (reserve, mark sold),
// not through this form.
const COMMON_AVAILABILITY = [
  {
    key: 'priceInInr',
    label: 'Price (₹)',
    inputType: 'NUMBER',
    isRequired: true,
    placeholder: 'Enter price',
    /** Grouped Indian-style as it is typed. The stored value stays a plain number. */
    format: 'INR',
  },
  {
    key: 'priceType',
    label: 'Price Type',
    inputType: 'SELECT',
    placeholder: 'Select price type',
    options: options('Fixed', 'Negotiable'),
  },
  // Location is deliberately absent: it comes from the store the listing
  // belongs to, so asking the partner for it again would let the two drift.
];

const COMMON_MEDIA = [
  {
    key: 'mainPhoto',
    label: 'Main Photo',
    inputType: 'MEDIA',
    isRequired: true,
    maxItems: 1,
    helpText: 'The first thing buyers see on your listing.',
  },
  {
    key: 'additionalPhotos',
    label: 'Additional Photos',
    inputType: 'MEDIA',
    maxItems: 9,
    helpText: 'Up to 9 more photos.',
  },
  {
    key: 'video',
    label: 'Video',
    inputType: 'MEDIA',
    maxItems: 2,
    helpText: 'Optional. Up to 2 short clips.',
  },
];

// ---------------------------------------------------------------------------
// Per-animal CATEGORY sections
// ---------------------------------------------------------------------------

const DOG_CATEGORY = [
  {
    key: 'breed',
    label: 'Breed',
    inputType: 'SELECT',
    isRequired: true,
    allowsOther: true,
    placeholder: 'Search or select breed',
    options: DOG_BREEDS,
  },
  {
    key: 'coatType',
    label: 'Coat Type',
    inputType: 'SELECT',
    placeholder: 'Select coat type',
    options: options('Short', 'Medium', 'Long', 'Curly', 'Double Coat', 'Wire Coat', 'Hairless'),
  },
  {
    key: 'temperament',
    label: 'Temperament',
    inputType: 'MULTI_SELECT',
    placeholder: 'Select traits',
    helpText: 'Pick every trait that fits — buyers filter on these.',
    options: options(
      'Friendly',
      'Playful',
      'Calm',
      'Active',
      'Energetic',
      'Protective',
      'Social',
      'Independent',
      'Good with Children',
      'Good with Other Pets',
      'Trained'
    ),
  },
  {
    key: 'trainingLevel',
    label: 'Training Level',
    inputType: 'SELECT',
    placeholder: 'Select training level',
    options: options('Not Trained', 'Basic Training', 'Obedience Trained', 'Advanced Trained', 'House Trained'),
  },
  {
    key: 'commandsKnown',
    label: 'Commands Known',
    inputType: 'MULTI_SELECT',
    allowsOther: true,
    placeholder: 'Select commands',
    options: options('Sit', 'Stay', 'Come', 'Down', 'Heel', 'Fetch'),
  },
  {
    key: 'pedigreeAvailable',
    label: 'Pedigree Available?',
    inputType: 'BOOLEAN',
  },
  {
    key: 'pedigreeCertificate',
    label: 'Pedigree Certificate',
    inputType: 'FILE',
    maxItems: 1,
    dependsOnKey: 'pedigreeAvailable',
    dependsOnValues: ['true'],
  },
  {
    key: 'registrationNumber',
    label: 'Registration Number',
    inputType: 'TEXT',
    placeholder: 'e.g. KCI/RG/2018/10442',
    dependsOnKey: 'pedigreeAvailable',
    dependsOnValues: ['true'],
  },
  // Parent details stay optional throughout — plenty of shops simply won't
  // have them, and a required field they can't answer stalls the listing.
  {
    key: 'fatherInfoAvailable',
    label: "Father's Details Available?",
    inputType: 'BOOLEAN',
  },
  {
    key: 'fatherName',
    label: "Father's Name",
    inputType: 'TEXT',
    placeholder: 'Enter name',
    dependsOnKey: 'fatherInfoAvailable',
    dependsOnValues: ['true'],
  },
  {
    key: 'fatherBreed',
    label: "Father's Breed",
    inputType: 'SELECT',
    allowsOther: true,
    placeholder: 'Select breed',
    dependsOnKey: 'fatherInfoAvailable',
    dependsOnValues: ['true'],
    options: DOG_BREEDS,
  },
  {
    key: 'fatherColor',
    label: "Father's Color",
    inputType: 'SELECT',
    placeholder: 'Select color',
    dependsOnKey: 'fatherInfoAvailable',
    dependsOnValues: ['true'],
    options: COLORS,
  },
  {
    key: 'motherInfoAvailable',
    label: "Mother's Details Available?",
    inputType: 'BOOLEAN',
  },
  {
    key: 'motherName',
    label: "Mother's Name",
    inputType: 'TEXT',
    placeholder: 'Enter name',
    dependsOnKey: 'motherInfoAvailable',
    dependsOnValues: ['true'],
  },
  {
    key: 'motherBreed',
    label: "Mother's Breed",
    inputType: 'SELECT',
    allowsOther: true,
    placeholder: 'Select breed',
    dependsOnKey: 'motherInfoAvailable',
    dependsOnValues: ['true'],
    options: DOG_BREEDS,
  },
  {
    key: 'motherColor',
    label: "Mother's Color",
    inputType: 'SELECT',
    placeholder: 'Select color',
    dependsOnKey: 'motherInfoAvailable',
    dependsOnValues: ['true'],
    options: COLORS,
  },
];

/**
 * The worked example for "how do we add another animal". Nothing about the
 * schema, the seeder, the API or the app changed to support cats — this
 * array and one line in `PET_FORM_SCHEMA` did.
 */
const CAT_CATEGORY = [
  {
    key: 'breed',
    label: 'Breed',
    inputType: 'SELECT',
    isRequired: true,
    allowsOther: true,
    placeholder: 'Search or select breed',
    options: CAT_BREEDS,
  },
  {
    key: 'coatType',
    label: 'Coat Type',
    inputType: 'SELECT',
    placeholder: 'Select coat type',
    options: options('Short', 'Medium', 'Long', 'Hairless'),
  },
  {
    key: 'temperament',
    label: 'Temperament',
    inputType: 'MULTI_SELECT',
    placeholder: 'Select traits',
    options: options(
      'Friendly',
      'Playful',
      'Calm',
      'Active',
      'Affectionate',
      'Independent',
      'Good with Children',
      'Good with Other Pets'
    ),
  },
  {
    key: 'isLitterTrained',
    label: 'Litter Trained?',
    inputType: 'BOOLEAN',
  },
];

// ---------------------------------------------------------------------------

/**
 * Flattened into rows by the seeder. `displayOrder` is the position within
 * each array, so reordering a field here reorders it in the app.
 *
 * RABBIT, HAMSTER, GUINEA_PIG, FISH and BIRD are listable today and get
 * every common section — they simply have no CATEGORY section yet. That is
 * a deliberate gap, not a stub: inventing breed lists for them would put
 * guesses in front of partners. Add an array above when there's real data.
 */
const PET_FORM_SCHEMA = [
  { petType: null, section: 'INFORMATION', fields: COMMON_INFORMATION },
  { petType: null, section: 'HEALTH', fields: COMMON_HEALTH },
  { petType: null, section: 'AVAILABILITY', fields: COMMON_AVAILABILITY },
  { petType: null, section: 'MEDIA', fields: COMMON_MEDIA },
  { petType: 'DOG', section: 'CATEGORY', fields: DOG_CATEGORY },
  { petType: 'CAT', section: 'CATEGORY', fields: CAT_CATEGORY },
];

module.exports = { PET_FORM_SCHEMA, slug, options };
