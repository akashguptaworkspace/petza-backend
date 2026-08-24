'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const REVIEW_CUSTOMER = {
  email: 'reviewer@petza.app',
  phone: '+919999000001',
  password: 'PetzaReview123',
  name: 'Petza Review User',
};

const REVIEW_PARTNER = {
  email: 'partner-review@petza.app',
  password: 'PetzaPartner123',
  ownerName: 'Petza Partner Review',
  storeName: 'Petza Review Kennel',
  storeSlug: 'petza-review-kennel',
  city: 'Bengaluru',
};

/**
 * Dedicated Play Console review credentials.
 *
 * This is intentionally a new seeder rather than only editing the older demo
 * seeders: environments that already ran those old seeders will not run them
 * again, but they will pick this one up on the next `db:seed:all`.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const customerPasswordHash = await bcrypt.hash(REVIEW_CUSTOMER.password, 10);
    const partnerPasswordHash = await bcrypt.hash(REVIEW_PARTNER.password, 10);

    const [users] = await queryInterface.sequelize.query('SELECT id, email, partner_store_id FROM users WHERE email IN (:emails)', {
      replacements: { emails: [REVIEW_CUSTOMER.email, REVIEW_PARTNER.email] },
    });
    const byEmail = new Map(users.map((user) => [user.email, user]));

    const customer = byEmail.get(REVIEW_CUSTOMER.email);
    if (customer) {
      await queryInterface.bulkUpdate(
        'users',
        {
          name: REVIEW_CUSTOMER.name,
          phone: REVIEW_CUSTOMER.phone,
          password_hash: customerPasswordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          partner_store_id: null,
          updated_at: now,
        },
        { email: REVIEW_CUSTOMER.email }
      );
    } else {
      await queryInterface.bulkInsert('users', [
        {
          id: uuidv4(),
          name: REVIEW_CUSTOMER.name,
          email: REVIEW_CUSTOMER.email,
          phone: REVIEW_CUSTOMER.phone,
          password_hash: customerPasswordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          partner_store_id: null,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [stores] = await queryInterface.sequelize.query('SELECT id FROM stores WHERE slug = :slug', {
      replacements: { slug: REVIEW_PARTNER.storeSlug },
    });

    const existingPartner = byEmail.get(REVIEW_PARTNER.email);
    const partnerUserId = existingPartner?.id ?? uuidv4();
    const partnerStoreId = stores[0]?.id ?? existingPartner?.partner_store_id ?? uuidv4();

    if (existingPartner) {
      await queryInterface.bulkUpdate(
        'users',
        {
          name: REVIEW_PARTNER.ownerName,
          password_hash: partnerPasswordHash,
          role: 'PARTNER_OWNER',
          status: 'ACTIVE',
          partner_store_id: partnerStoreId,
          updated_at: now,
        },
        { email: REVIEW_PARTNER.email }
      );
    } else {
      await queryInterface.bulkInsert('users', [
        {
          id: partnerUserId,
          name: REVIEW_PARTNER.ownerName,
          email: REVIEW_PARTNER.email,
          phone: null,
          password_hash: partnerPasswordHash,
          role: 'PARTNER_OWNER',
          status: 'ACTIVE',
          partner_store_id: partnerStoreId,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    if (stores.length) {
      await queryInterface.bulkUpdate(
        'stores',
        {
          owner_user_id: partnerUserId,
          name: REVIEW_PARTNER.storeName,
          business_type: 'KENNEL',
          capabilities: 'SELL_PETS',
          status: 'ACTIVE',
          owner_name: REVIEW_PARTNER.ownerName,
          city: REVIEW_PARTNER.city,
          phone: null,
          email: REVIEW_PARTNER.email,
          is_verified: true,
          rejection_reason: null,
          kyc_submitted_at: now,
          reviewed_at: now,
          updated_at: now,
        },
        { slug: REVIEW_PARTNER.storeSlug }
      );
      return;
    }

    await queryInterface.bulkInsert('stores', [
      {
        id: partnerStoreId,
        owner_user_id: partnerUserId,
        name: REVIEW_PARTNER.storeName,
        slug: REVIEW_PARTNER.storeSlug,
        business_type: 'KENNEL',
        capabilities: 'SELL_PETS',
        status: 'ACTIVE',
        owner_name: REVIEW_PARTNER.ownerName,
        city: REVIEW_PARTNER.city,
        phone: null,
        email: REVIEW_PARTNER.email,
        is_verified: true,
        rejection_reason: null,
        kyc_submitted_at: now,
        reviewed_at: now,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('kennel_profiles', [
      {
        id: uuidv4(),
        store_id: partnerStoreId,
        years_active: 3,
        registration_number: 'PETZA-REVIEW-001',
        pincode: '560001',
        breeds: JSON.stringify(['persian', 'siamese', 'maine-coon']),
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('stores', { slug: REVIEW_PARTNER.storeSlug });
    await queryInterface.bulkDelete('users', { email: [REVIEW_CUSTOMER.email, REVIEW_PARTNER.email] });
  },
};
