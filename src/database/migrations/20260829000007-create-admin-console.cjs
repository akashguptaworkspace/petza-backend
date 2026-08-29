'use strict';

/**
 * What the admin shell reads and writes — PRODUCT_CONTEXT.md §8.
 *
 * One deliberate deviation from the spec's schema. The spec lists a
 * separate `admin_users` table; this migration adds `users.admin_role`
 * instead. Admins already authenticate through `users` (Role.ADMIN /
 * Role.SUPER_ADMIN, one login screen for both shells, §8), so a second
 * identity table would mean two password stores, two OTP paths and two
 * token subjects for one person. The spec's *intent* — sub-roles that
 * scope what an admin may touch — is met by the column; the second table
 * is not.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    };

    /**
     * Null for every non-admin account. SUPER_ADMIN is the only value that
     * can grant this column to someone else.
     */
    await queryInterface.addColumn('users', 'admin_role', {
      type: Sequelize.ENUM('SUPER_ADMIN', 'CATEGORY_MANAGER', 'SUPPORT_AGENT', 'FINANCE_MANAGER'),
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      "UPDATE users SET admin_role = 'SUPER_ADMIN' WHERE role IN ('ADMIN','SUPER_ADMIN')"
    );

    /**
     * Append-only. Every admin action that changes someone else's data
     * writes one row with the before and after, which is the whole point —
     * a moderation decision has to be explicable months later.
     */
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // SET NULL, not CASCADE: an admin leaving must not erase the record
      // of what they approved.
      admin_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      /** Verb, screaming snake — `APPROVE_LISTING`, `SUSPEND_PARTNER`, `REJECT_KYC`. */
      action: { type: Sequelize.STRING(80), allowNull: false },
      /** Table-ish name of what was acted on — `product_listing`, `store`, `review`. */
      entity_type: { type: Sequelize.STRING(80), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      before_state: { type: Sequelize.JSON, allowNull: true },
      after_state: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id', 'created_at'], {
      name: 'audit_logs_entity_created',
    });
    await queryInterface.addIndex('audit_logs', ['admin_user_id', 'created_at'], {
      name: 'audit_logs_admin_created',
    });

    /** Hero/promo slots on the *customer* app, authored from the admin shell. */
    await queryInterface.createTable('banners', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      title: { type: Sequelize.STRING, allowNull: false },
      subtitle: { type: Sequelize.STRING, allowNull: true },
      image_url: { type: Sequelize.TEXT, allowNull: true },
      cta_text: { type: Sequelize.STRING(60), allowNull: true },
      /** A deep link into the customer app, not a web URL. */
      cta_link: { type: Sequelize.STRING, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      /**
       * Both null means "live whenever `is_active`". A window plus the
       * flag lets a campaign be scheduled and still killed instantly.
       */
      starts_at: { type: Sequelize.DATE, allowNull: true },
      ends_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });

    await queryInterface.addIndex('banners', ['is_active', 'sort_order'], { name: 'banners_active_sort' });

    await queryInterface.createTable('broadcast_notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      admin_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      target_audience: { type: Sequelize.ENUM('ALL', 'PARTNERS', 'CONSUMERS'), allowNull: false },
      /** Null until it actually goes out — an unsent row is a draft. */
      sent_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });

    await queryInterface.addIndex('broadcast_notifications', ['sent_at'], { name: 'broadcast_notifications_sent_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('broadcast_notifications');
    await queryInterface.dropTable('banners');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.removeColumn('users', 'admin_role');
  },
};
