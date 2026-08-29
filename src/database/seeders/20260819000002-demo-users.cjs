'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Mirrors petza-partner's src/mocks/authUsers.mock.ts demo accounts so the
 * login screen behaves identically once EXPO_PUBLIC_USE_MOCK_API is flipped
 * to false — same emails/passwords, same role split.
 *
 * Idempotent by design (checks for existing emails before inserting)
 * rather than assuming an empty table — this is the seeder POST
 * /system/seed runs on every call, including re-runs against a database
 * that already has these demo accounts (e.g. from a previous seed, or
 * real usage since). A plain bulkInsert would throw a unique-constraint
 * error on the second run; see 20260823000003-demo-partner-stores.cjs for
 * the same "look up existing, only insert what's missing" shape.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const emails = ['admin@petza.app', 'partner@petza.app', 'reviewer@petza.app'];

    const [existing] = await queryInterface.sequelize.query(
      'SELECT email FROM users WHERE email IN (:emails)',
      { replacements: { emails } }
    );
    const existingEmails = new Set(existing.map((row) => row.email));

    const newUsers = [];

    if (!existingEmails.has('admin@petza.app')) {
      newUsers.push({
        id: uuidv4(),
        name: 'Admin User',
        email: 'admin@petza.app',
        phone: null,
        password_hash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        status: 'ACTIVE',
        partner_store_id: null,
        created_at: now,
        updated_at: now,
      });
    }

    if (!existingEmails.has('partner@petza.app')) {
      newUsers.push({
        id: uuidv4(),
        name: 'Ramesh Kumar',
        email: 'partner@petza.app',
        phone: null,
        password_hash: await bcrypt.hash('partner123', 10),
        role: 'PARTNER',
        status: 'ACTIVE',
        partner_store_id: uuidv4(),
        created_at: now,
        updated_at: now,
      });
    }

    if (!existingEmails.has('reviewer@petza.app')) {
      newUsers.push({
        id: uuidv4(),
        name: 'Petza Review User',
        email: 'reviewer@petza.app',
        phone: '+919999000001',
        password_hash: await bcrypt.hash('PetzaReview123', 10),
        role: 'CUSTOMER',
        status: 'ACTIVE',
        partner_store_id: null,
        created_at: now,
        updated_at: now,
      });
    }

    if (newUsers.length) await queryInterface.bulkInsert('users', newUsers);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: ['admin@petza.app', 'partner@petza.app', 'reviewer@petza.app'] });
  },
};
