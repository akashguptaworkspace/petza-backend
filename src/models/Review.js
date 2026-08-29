import { DataTypes, Model } from 'sequelize';

import { ModerationStatus, ReviewReferenceType } from '../config/constants.js';

/**
 * A customer's rating of a completed transaction (PRODUCT_CONTEXT.md §5).
 *
 * A review always hangs off an order or a booking, never off a bare store.
 * That is what stops a partner being rated by someone who never bought
 * from them, and it is why `referenceType` + `referenceId` are required —
 * with a unique index behind them, so a second attempt is an edit rather
 * than a second row.
 *
 * Moderated like a listing (§8): a flagged review is held at PENDING and
 * never reaches the customer app.
 */
export default (sequelize) => {
  class Review extends Model {
    static associate(db) {
      Review.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      Review.belongsTo(db.User, { as: 'customer', foreignKey: 'customerUserId' });
    }
  }

  Review.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      customerUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      /** Polymorphic for the same reason as `WalletTransaction.referenceType` — one column, two possible tables. */
      referenceType: {
        type: DataTypes.ENUM(...Object.values(ReviewReferenceType)),
        allowNull: false,
      },
      referenceId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rating: {
        type: DataTypes.TINYINT,
        allowNull: false,
        validate: { min: 1, max: 5 },
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      /** The partner's public answer. Exactly one per review, so it lives here rather than in a replies table. */
      partnerReply: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      partnerRepliedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      moderationStatus: {
        type: DataTypes.ENUM(...Object.values(ModerationStatus)),
        allowNull: false,
        defaultValue: ModerationStatus.PENDING,
      },
      /** Raised by either side; what puts a row in the admin moderation queue. */
      isFlagged: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'reviews',
    }
  );

  return Review;
};
