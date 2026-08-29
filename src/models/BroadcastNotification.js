import { DataTypes, Model } from 'sequelize';

import { BroadcastAudience } from '../config/constants.js';

/**
 * A push an admin sends to a whole audience at once
 * (PRODUCT_CONTEXT.md §8).
 *
 * `sentAt` doubles as the draft flag — a row with none has been composed
 * but not sent, which is why it is nullable rather than defaulting to now.
 * Sending is a one-way transition: editing a broadcast after it has gone
 * out would leave the record disagreeing with what people actually
 * received, so the service refuses it.
 */
export default (sequelize) => {
  class BroadcastNotification extends Model {
    static associate(db) {
      BroadcastNotification.belongsTo(db.User, { as: 'admin', foreignKey: 'adminUserId' });
    }

    get isDraft() {
      return this.sentAt === null;
    }
  }

  BroadcastNotification.init(
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      targetAudience: {
        type: DataTypes.ENUM(...Object.values(BroadcastAudience)),
        allowNull: false,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'BroadcastNotification',
      tableName: 'broadcast_notifications',
    }
  );

  return BroadcastNotification;
};
