'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Gives the demo partners a real store each, so logging in as one lands on
 * a dashboard instead of bouncing back to the role screen — a partner's
 * business type and approval status both come from their store row.
 *
 * Mirrors petza-partner's src/mocks/authUsers.mock.ts: the kennel account
 * is the one the earlier user seeder already created (partner@petza.app,
 * "Ramesh Kumar"), and the vet, groomer and trainer accounts are added
 * here alongside their stores. Those three all carry PROVIDE_CARE, so all
 * three open the same (care) dashboards with their own wording — which is
 * the thing worth being able to click through by hand.
 *
 * There is deliberately no pet-shop demo account — a pet shop is a KENNEL.
 */

const STORES = [
  {
    email: 'partner@petza.app',
    businessType: 'STORE',
    offersProducts: true,
    offersServices: false,
    name: 'Happy Paws Pet Supplies',
    slug: 'happy-paws-pet-supplies',
    ownerName: 'Ramesh Kumar',
    city: 'Bengaluru',
  },
  {
    email: 'partner-review@petza.app',
    password: 'PetzaPartner123',
    businessType: 'STORE',
    // The one demo account with both capabilities on — the only way to
    // click through the Products|Services and Orders|Bookings segmented
    // controls, which never render for a single-capability partner (§3).
    offersProducts: true,
    offersServices: true,
    name: 'Petza Review Store',
    slug: 'petza-review-store',
    ownerName: 'Petza Partner Review',
    city: 'Bengaluru',
  },
  {
    email: 'vet@petza.app',
    businessType: 'CLINIC',
    offersProducts: false,
    offersServices: true,
    name: 'Marigold Veterinary Clinic',
    slug: 'marigold-veterinary-clinic',
    ownerName: 'Dr. Anika Mehra',
    city: 'Pune',
  },
  {
    email: 'groomer@petza.app',
    businessType: 'GROOMER',
    offersProducts: false,
    offersServices: true,
    name: 'Fluff & Fold Pet Spa',
    slug: 'fluff-and-fold-pet-spa',
    ownerName: 'Nisha Rao',
    city: 'Bengaluru',
  },
  {
    email: 'trainer@petza.app',
    businessType: 'INDIVIDUAL',
    offersProducts: false,
    offersServices: true,
    name: 'K9 Craft Dog Training',
    slug: 'k9-craft-dog-training',
    ownerName: 'Dev Raghavan',
    city: 'Mumbai',
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id, email, partner_store_id FROM users WHERE email IN (:emails)',
      { replacements: { emails: STORES.map((store) => store.email) } }
    );
    const byEmail = new Map(existing.map((row) => [row.email, row]));

    // Re-running this seeder against a database that already has these
    // stores (a second `db:seed:all`, or a VM re-seeded after real dev
    // usage) must not try to re-insert them — `stores.slug` is unique, so
    // an unconditional bulkInsert throws. Skip by slug, the same identity
    // STORES itself is keyed on.
    const [existingStores] = await queryInterface.sequelize.query('SELECT slug FROM stores WHERE slug IN (:slugs)', {
      replacements: { slugs: STORES.map((s) => s.slug) },
    });
    const existingSlugs = new Set(existingStores.map((row) => row.slug));

    const newUsers = [];
    const stores = [];
    const kennelProfiles = [];
    const vetProfiles = [];
    const trainerProfiles = [];
    const groomerProfiles = [];

    for (const store of STORES) {
      // Already seeded — the store row, its profile and (if it already
      // existed) its user are all in place from a previous run.
      if (existingSlugs.has(store.slug)) continue;

      const user = byEmail.get(store.email);
      const userId = user ? user.id : uuidv4();
      // Reuse the placeholder id the user seeder already wrote into
      // partner_store_id, so the two rows point at each other without
      // having to rewrite the user.
      const storeId = user && user.partner_store_id ? user.partner_store_id : uuidv4();

      if (!user) {
        newUsers.push({
          id: userId,
          name: store.ownerName,
          email: store.email,
          phone: null,
          password_hash: await bcrypt.hash(store.password ?? 'partner123', 10),
          role: 'PARTNER',
          status: 'ACTIVE',
          partner_store_id: storeId,
          created_at: now,
          updated_at: now,
        });
      }

      stores.push({
        id: storeId,
        owner_user_id: userId,
        name: store.name,
        slug: store.slug,
        business_type: store.businessType,
        offers_products: store.offersProducts,
        offers_services: store.offersServices,
        // Pre-approved so the demo login opens the dashboard directly —
        // an account still mid-KYC is what the signup flow itself produces.
        status: 'ACTIVE',
        owner_name: store.ownerName,
        city: store.city,
        phone: null,
        email: store.email,
        is_verified: true,
        rejection_reason: null,
        kyc_submitted_at: now,
        reviewed_at: now,
        created_at: now,
        updated_at: now,
      });

      const profile = { id: uuidv4(), store_id: storeId, created_at: now, updated_at: now };
      if (store.businessType === 'KENNEL') {
        kennelProfiles.push({
          ...profile,
          years_active: 8,
          registration_number: 'KCI-2018-4471',
          pincode: '560001',
          breeds: JSON.stringify(['golden-retriever', 'labrador', 'beagle']),
        });
      }
      if (store.businessType === 'VET') {
        vetProfiles.push({
          ...profile,
          council_registration_number: 'MVC-2015-7782',
          services: JSON.stringify(['consultation', 'vaccination', 'deworming', 'teleconsult']),
        });
      }
      if (store.businessType === 'GROOMER') {
        groomerProfiles.push({
          ...profile,
          experience_years: 5,
          is_mobile: false,
          services: JSON.stringify(['full-groom', 'bath-brush', 'nail-trim', 'de-shedding']),
          pet_types: JSON.stringify(['dogs', 'cats']),
        });
      }
      if (store.businessType === 'TRAINER') {
        trainerProfiles.push({
          ...profile,
          experience_years: 6,
          certification_body: 'ccpdt',
          certification_number: 'CCPDT-99120',
          base_area: 'Andheri West',
          travel_radius_km: 15,
          training_offered: JSON.stringify(['puppy-basics', 'leash-manners', 'reactivity']),
        });
      }
    }

    if (newUsers.length) await queryInterface.bulkInsert('users', newUsers);
    if (stores.length) await queryInterface.bulkInsert('stores', stores);
    if (kennelProfiles.length) await queryInterface.bulkInsert('kennel_profiles', kennelProfiles);
    if (vetProfiles.length) await queryInterface.bulkInsert('vet_profiles', vetProfiles);
    if (trainerProfiles.length) await queryInterface.bulkInsert('trainer_profiles', trainerProfiles);
    if (groomerProfiles.length) await queryInterface.bulkInsert('groomer_profiles', groomerProfiles);
  },

  async down(queryInterface) {
    // The profile rows go with their stores (ON DELETE CASCADE).
    await queryInterface.bulkDelete('stores', { slug: STORES.map((store) => store.slug) });
    await queryInterface.bulkDelete('users', { email: ['partner-review@petza.app', 'vet@petza.app', 'trainer@petza.app', 'groomer@petza.app'] });
  },
};
