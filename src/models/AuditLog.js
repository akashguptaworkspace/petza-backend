import { DataTypes, Model } from 'sequelize';

/**
 * One admin action, with what the record looked like before and after
 * (PRODUCT_CONTEXT.md §8).
 *
 * Append-only and never updated — the point is that a moderation decision
 * stays explicable months later. `adminUserId` is nullable and set to null
 * rather than cascading when an admin account goes, so someone leaving
 * doesn't erase the record of what they approved.
 *
 * `updatedAt` is off: a row that is only ever inserted has nothing to
 * update, and the column would just be a copy of `createdAt`.
 */
export default (sequelize) => {
  class AuditLog extends Model {
    static associate(db) {
      AuditLog.belongsTo(db.User, { as: 'admin', foreignKey: 'adminUserId' });
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      /** Verb, screaming snake — `APPROVE_LISTING`, `SUSPEND_PARTNER`, `REJECT_KYC`. */
      action: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      /** What was acted on — `product_listing`, `store`, `review`. */
      entityType: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      beforeState: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      afterState: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      updatedAt: false,
    }
  );

  return AuditLog;
};
