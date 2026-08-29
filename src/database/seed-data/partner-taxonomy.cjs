'use strict';

/**
 * The starting taxonomy partners choose from — PRODUCT_CONTEXT.md §4.
 *
 * Data, not code: the seeder walks this file and inserts rows. Nothing in
 * either app hardcodes a member of it (§10), so admin can add a tag or a
 * field through the Catalog screens afterwards and neither app needs a
 * release. This file is only the *initial* state.
 *
 * Attributes are written per tag in the compact `[key, label, type, …]`
 * shape below because the alternative — ~90 fully-spelled row objects —
 * buries the one thing worth reading, which is what a partner is actually
 * asked when they list under each tag.
 */

/** Every tag asks this. Spelled once and spread into each attribute list. */
const PET_TYPES = {
  key: 'pet_types',
  label: 'Suitable for',
  type: 'MULTISELECT',
  required: true,
  options: ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Guinea pig'],
};

const SIZE = {
  key: 'size',
  label: 'Size',
  type: 'SELECT',
  options: ['Extra small', 'Small', 'Medium', 'Large', 'Extra large'],
};

/**
 * `Accessories` is the single product root (§4.1). Its children are
 * selectable tags, never a browsable menu — they exist to key these form
 * fields and to filter search.
 */
const PRODUCT_TAGS = [
  {
    name: 'Food',
    slug: 'food',
    icon: 'bowl',
    attributes: [
      PET_TYPES,
      { key: 'life_stage', label: 'Life stage', type: 'SELECT', required: true, options: ['Puppy / Kitten', 'Adult', 'Senior', 'All stages'] },
      { key: 'food_form', label: 'Form', type: 'SELECT', required: true, options: ['Dry', 'Wet', 'Semi-moist', 'Raw', 'Treat'] },
      { key: 'net_weight', label: 'Net weight', type: 'NUMBER', required: true, unit: 'g' },
      { key: 'flavour', label: 'Flavour', type: 'TEXT', hint: 'Chicken, salmon, lamb…' },
      { key: 'is_vegetarian', label: 'Vegetarian', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Grooming supplies',
    slug: 'grooming-supplies',
    icon: 'scissors',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Shampoo', 'Conditioner', 'Brush', 'Comb', 'Clipper', 'Nail care', 'Wipes', 'Dryer'] },
      { key: 'volume', label: 'Volume', type: 'NUMBER', unit: 'ml' },
      { key: 'coat_type', label: 'Coat type', type: 'MULTISELECT', options: ['Short', 'Medium', 'Long', 'Curly', 'Double coat'] },
    ],
  },
  {
    name: 'Toys',
    slug: 'toys',
    icon: 'tennisball',
    attributes: [
      PET_TYPES,
      { key: 'toy_type', label: 'Toy type', type: 'SELECT', required: true, options: ['Chew', 'Fetch', 'Interactive', 'Plush', 'Rope', 'Puzzle', 'Catnip'] },
      SIZE,
      { key: 'material', label: 'Material', type: 'TEXT', hint: 'Rubber, cotton, plush…' },
      { key: 'is_squeaky', label: 'Squeaky', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Collars, leashes & harnesses',
    slug: 'collars-leashes-harnesses',
    icon: 'collar',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Collar', 'Leash', 'Harness', 'Muzzle', 'ID tag'] },
      SIZE,
      { key: 'material', label: 'Material', type: 'TEXT', hint: 'Nylon, leather, mesh…' },
      { key: 'is_adjustable', label: 'Adjustable', type: 'BOOLEAN' },
      { key: 'is_reflective', label: 'Reflective', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Beds & carriers',
    slug: 'beds-carriers',
    icon: 'bed',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Bed', 'Mat', 'Blanket', 'Carrier', 'Crate', 'Kennel'] },
      SIZE,
      { key: 'is_washable', label: 'Machine washable', type: 'BOOLEAN' },
      { key: 'is_travel_safe', label: 'Airline / travel approved', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Bowls & feeders',
    slug: 'bowls-feeders',
    icon: 'bowl-feeder',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Bowl', 'Slow feeder', 'Automatic feeder', 'Water fountain', 'Bottle'] },
      { key: 'capacity', label: 'Capacity', type: 'NUMBER', unit: 'ml' },
      { key: 'material', label: 'Material', type: 'SELECT', options: ['Stainless steel', 'Ceramic', 'Plastic', 'Silicone', 'Melamine'] },
    ],
  },
  {
    name: 'Hygiene',
    slug: 'hygiene',
    icon: 'sparkles',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Litter', 'Litter box', 'Training pads', 'Poop bags', 'Wipes', 'Odour remover'] },
      { key: 'pack_size', label: 'Pack size', type: 'NUMBER', hint: 'Units per pack' },
      { key: 'is_biodegradable', label: 'Biodegradable', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Habitat & housing',
    slug: 'habitat-housing',
    icon: 'home',
    attributes: [
      PET_TYPES,
      { key: 'habitat_type', label: 'Type', type: 'SELECT', required: true, options: ['Cage', 'Aquarium', 'Terrarium', 'Hutch', 'Coop', 'Aviary'] },
      { key: 'dimensions', label: 'Dimensions', type: 'TEXT', hint: 'L × W × H in cm' },
      { key: 'capacity', label: 'Capacity', type: 'NUMBER', unit: 'L' },
    ],
  },
  {
    name: 'Training equipment',
    slug: 'training-equipment',
    icon: 'whistle',
    attributes: [
      PET_TYPES,
      { key: 'equipment_type', label: 'Type', type: 'SELECT', required: true, options: ['Clicker', 'Training treat pouch', 'Agility set', 'Long line', 'Target stick', 'Deterrent spray'] },
      SIZE,
    ],
  },
  {
    name: 'Clothing & apparel',
    slug: 'clothing-apparel',
    icon: 'shirt',
    attributes: [
      PET_TYPES,
      { key: 'apparel_type', label: 'Type', type: 'SELECT', required: true, options: ['Sweater', 'Jacket', 'Raincoat', 'Shoes', 'Bandana', 'Costume'] },
      SIZE,
      { key: 'season', label: 'Season', type: 'SELECT', options: ['Winter', 'Monsoon', 'Summer', 'All season'] },
    ],
  },
  {
    name: 'Travel & outdoor gear',
    slug: 'travel-outdoor-gear',
    icon: 'backpack',
    attributes: [
      PET_TYPES,
      { key: 'gear_type', label: 'Type', type: 'SELECT', required: true, options: ['Travel carrier', 'Car seat', 'Car harness', 'Backpack', 'Stroller', 'Travel bowl'] },
      SIZE,
      { key: 'max_pet_weight', label: 'Max pet weight', type: 'NUMBER', unit: 'kg' },
    ],
  },
  {
    name: 'Supplements & vitamins',
    slug: 'supplements-vitamins',
    icon: 'pill',
    // Health claims — a partner proves a licence before listing under this.
    requiresVerification: true,
    attributes: [
      PET_TYPES,
      { key: 'supplement_form', label: 'Form', type: 'SELECT', required: true, options: ['Tablet', 'Powder', 'Liquid', 'Chew', 'Paste'] },
      { key: 'purpose', label: 'Supports', type: 'MULTISELECT', required: true, options: ['Joints', 'Skin & coat', 'Digestion', 'Immunity', 'Calming', 'Dental', 'Multivitamin'] },
      { key: 'net_weight', label: 'Net weight', type: 'NUMBER', unit: 'g' },
      { key: 'dosage', label: 'Dosage', type: 'TEXT', hint: 'e.g. 1 tablet per 10 kg, daily' },
    ],
  },
  {
    name: 'Medicines',
    slug: 'medicines',
    icon: 'medical',
    requiresVerification: true,
    attributes: [
      PET_TYPES,
      { key: 'medicine_form', label: 'Form', type: 'SELECT', required: true, options: ['Tablet', 'Syrup', 'Injection', 'Topical', 'Spot-on', 'Spray', 'Drops'] },
      { key: 'treats', label: 'Treats', type: 'MULTISELECT', required: true, options: ['Ticks & fleas', 'Deworming', 'Infection', 'Allergy', 'Pain', 'Eye', 'Ear', 'Skin'] },
      { key: 'is_prescription_required', label: 'Prescription required', type: 'BOOLEAN', required: true },
      { key: 'composition', label: 'Composition', type: 'TEXT', hint: 'Active ingredients' },
      { key: 'expiry_date', label: 'Expiry', type: 'TEXT', hint: 'MM/YYYY' },
    ],
  },
  {
    name: 'First aid',
    slug: 'first-aid',
    icon: 'bandage',
    attributes: [
      PET_TYPES,
      { key: 'item_type', label: 'Type', type: 'SELECT', required: true, options: ['Kit', 'Bandage', 'Antiseptic', 'Tick remover', 'Thermometer', 'Cone / collar'] },
      { key: 'pack_size', label: 'Pack size', type: 'NUMBER', hint: 'Units per pack' },
    ],
  },
];

/**
 * The seven service categories (§4.2). Flat — no tag level — because each
 * one has a materially different booking form, which is exactly what the
 * differing attribute lists below are.
 */
const SERVICE_CATEGORIES = [
  {
    name: 'Veterinary',
    slug: 'veterinary',
    icon: 'stethoscope',
    // The one service category gated behind a licence check.
    requiresVerification: true,
    attributes: [
      PET_TYPES,
      { key: 'consultation_type', label: 'Consultation type', type: 'SELECT', required: true, options: ['In-clinic', 'Home visit', 'Tele-consult'] },
      { key: 'specialisation', label: 'Specialisation', type: 'MULTISELECT', options: ['General', 'Surgery', 'Dermatology', 'Dentistry', 'Orthopaedics', 'Cardiology', 'Ophthalmology', 'Exotic pets'] },
      { key: 'is_emergency_available', label: 'Emergency available', type: 'BOOLEAN' },
      { key: 'vet_experience_years', label: "Vet's experience", type: 'NUMBER', unit: 'years' },
    ],
  },
  {
    name: 'Grooming',
    slug: 'grooming',
    icon: 'scissors',
    attributes: [
      PET_TYPES,
      { key: 'services_included', label: 'Included', type: 'MULTISELECT', required: true, options: ['Bath', 'Haircut', 'Nail trim', 'Ear cleaning', 'Teeth brushing', 'De-shedding', 'De-matting', 'Flea treatment'] },
      { key: 'coat_types', label: 'Coat types handled', type: 'MULTISELECT', options: ['Short', 'Medium', 'Long', 'Curly', 'Double coat'] },
      { key: 'pet_size_limit', label: 'Largest pet accepted', type: 'SELECT', options: ['Small', 'Medium', 'Large', 'Any size'] },
    ],
  },
  {
    name: 'Boarding & Daycare',
    slug: 'boarding-daycare',
    icon: 'home',
    attributes: [
      PET_TYPES,
      { key: 'stay_type', label: 'Stay type', type: 'SELECT', required: true, options: ['Day care', 'Overnight', 'Extended stay'] },
      { key: 'max_pets', label: 'Pets accepted at once', type: 'NUMBER', required: true },
      { key: 'facilities', label: 'Facilities', type: 'MULTISELECT', options: ['Air conditioned', 'Play area', 'CCTV', 'Daily updates', 'Meals included', 'Vet on call', 'Pick-up & drop'] },
      { key: 'is_vaccination_required', label: 'Vaccination proof required', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Training & Behavior',
    slug: 'training-behavior',
    icon: 'whistle',
    attributes: [
      PET_TYPES,
      { key: 'training_type', label: 'Training type', type: 'MULTISELECT', required: true, options: ['Basic obedience', 'Puppy training', 'Behaviour correction', 'Agility', 'Guard training', 'Socialisation'] },
      { key: 'session_format', label: 'Format', type: 'SELECT', required: true, options: ['One-on-one', 'Group', 'Board & train'] },
      { key: 'sessions_in_package', label: 'Sessions in package', type: 'NUMBER' },
      { key: 'trainer_experience_years', label: "Trainer's experience", type: 'NUMBER', unit: 'years' },
    ],
  },
  {
    name: 'Walking & Sitting',
    slug: 'walking-sitting',
    icon: 'walk',
    attributes: [
      PET_TYPES,
      { key: 'service_type', label: 'Service', type: 'SELECT', required: true, options: ['Dog walking', 'Pet sitting', 'Drop-in visit', 'Overnight sitting'] },
      { key: 'walk_duration', label: 'Time per visit', type: 'NUMBER', unit: 'minutes' },
      { key: 'max_pets_per_visit', label: 'Pets per visit', type: 'NUMBER' },
      { key: 'is_gps_tracked', label: 'GPS-tracked walks', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Transport',
    slug: 'transport',
    icon: 'car',
    attributes: [
      PET_TYPES,
      { key: 'vehicle_type', label: 'Vehicle', type: 'SELECT', required: true, options: ['Car', 'Van', 'Air-conditioned van', 'Ambulance'] },
      { key: 'max_distance_km', label: 'Maximum distance', type: 'NUMBER', unit: 'km' },
      { key: 'is_crate_provided', label: 'Crate provided', type: 'BOOLEAN' },
      { key: 'is_attendant_included', label: 'Attendant travels along', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'Photography',
    slug: 'photography',
    icon: 'camera',
    attributes: [
      PET_TYPES,
      { key: 'shoot_type', label: 'Shoot type', type: 'SELECT', required: true, options: ['Studio', 'Outdoor', 'At home', 'Event'] },
      { key: 'photos_delivered', label: 'Edited photos delivered', type: 'NUMBER' },
      { key: 'delivery_days', label: 'Delivery time', type: 'NUMBER', unit: 'days' },
      { key: 'includes_props', label: 'Props & costumes included', type: 'BOOLEAN' },
    ],
  },
];

/** The single product root every product listing hangs off (§4.1). */
const PRODUCT_ROOT = {
  name: 'Accessories',
  slug: 'accessories',
  icon: 'package',
};

module.exports = { PRODUCT_ROOT, PRODUCT_TAGS, SERVICE_CATEGORIES };
