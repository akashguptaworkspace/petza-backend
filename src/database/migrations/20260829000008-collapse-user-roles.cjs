'use strict';

/**
 * Six roles down to three.
 *
 * `users.role` used to carry a seat level as well as an identity —
 * PARTNER_OWNER / PARTNER_MANAGER / PARTNER_STAFF for one side,
 * ADMIN / SUPER_ADMIN for the other. Nothing ever branched on the partner
 * seat levels (a store has exactly one owner and no staff table exists),
 * and the admin split now lives in `users.admin_role`, added in
 * 20260829000007 with its own four-way sub-role.
 *
 * What is left is the only distinction the token and the route guards
 * actually make: which app you belong to.
 *
 *   CUSTOMER — the customer app
 *   PARTNER  — the partner shell of the partner app
 *   ADMIN    — the admin shell of the same binary (§8)
 *
 * Seat levels come back, if they ever need to, as a `store_members` table
 * with its own role column — not as more members here, where they would
 * once again be indistinguishable from identity.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    // Widen first: the translating UPDATE can only run while both the old
    // and new members are legal values.
    await sequelize.query(
      "ALTER TABLE users MODIFY role ENUM('CUSTOMER','PARTNER_OWNER','PARTNER_MANAGER','PARTNER_STAFF','ADMIN','SUPER_ADMIN','PARTNER') NOT NULL"
    );
    await sequelize.query(
      "UPDATE users SET role = 'PARTNER' WHERE role IN ('PARTNER_OWNER','PARTNER_MANAGER','PARTNER_STAFF')"
    );
    // 20260829000007 already stamped admin_role = SUPER_ADMIN on both, so
    // the distinction survives the collapse.
    await sequelize.query("UPDATE users SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN'");
    await sequelize.query("ALTER TABLE users MODIFY role ENUM('CUSTOMER','PARTNER','ADMIN') NOT NULL");
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(
      "ALTER TABLE users MODIFY role ENUM('CUSTOMER','PARTNER_OWNER','PARTNER_MANAGER','PARTNER_STAFF','ADMIN','SUPER_ADMIN','PARTNER') NOT NULL"
    );
    // Every partner becomes an owner again — the seat level they had
    // before is not recoverable, and owner is the only one the app ever
    // created.
    await sequelize.query("UPDATE users SET role = 'PARTNER_OWNER' WHERE role = 'PARTNER'");
    await sequelize.query("UPDATE users SET role = 'SUPER_ADMIN' WHERE admin_role = 'SUPER_ADMIN' AND role = 'ADMIN'");
    await sequelize.query(
      "ALTER TABLE users MODIFY role ENUM('CUSTOMER','PARTNER_OWNER','PARTNER_MANAGER','PARTNER_STAFF','ADMIN','SUPER_ADMIN') NOT NULL"
    );
  },
};
