import { Model, DataTypes } from 'sequelize';

import { AdminRole, Role } from '../config/constants.js';

export default (sequelize) => {
  class User extends Model {}

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      /** Nullable — a phone-only OTP account may never set one. At least one of email/phone is required (enforced by the DB check constraint and the service layer). */
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: { isEmail: true },
      },
      /** Nullable — an email-only account (password or Google) may never set one. */
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      /** Nullable — Google-only or OTP-only accounts have no password to check. */
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      /** Which app this account belongs to — CUSTOMER, PARTNER or ADMIN, and nothing finer. */
      role: {
        type: DataTypes.ENUM(...Object.values(Role)),
        allowNull: false,
      },
      /**
       * Which slice of the admin console this admin may touch. Null for
       * every non-ADMIN account — the sub-role lives here rather than as
       * more `role` members so that "which app" and "what may they do"
       * stop being the same field (see migration 20260829000008).
       */
      adminRole: {
        type: DataTypes.ENUM(...Object.values(AdminRole)),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      /**
       * Denormalized placeholder until the Store model exists (Phase 4) —
       * only meaningful for PARTNER_* roles. Migrate to a real
       * `stores.id` foreign key once Store is introduced.
       */
      partnerStoreId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        withPassword: { attributes: {} },
      },
    }
  );

  return User;
};
