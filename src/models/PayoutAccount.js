import { DataTypes, Model } from 'sequelize';

import { PayoutMethod } from '../config/constants.js';

/**
 * Where a partner's withdrawals go (PRODUCT_CONTEXT.md §5).
 *
 * `method` decides which group of columns is filled and leaves the other
 * null — a UPI account has no IFSC, a bank account has no VPA. They stay
 * as separate typed columns rather than one JSON blob because finance
 * queries and validates them individually.
 *
 * `accountNumber` is stored whole. Screens mask all but the last four, but
 * a payout run needs the real value, so masking is a presentation concern
 * and not a storage one.
 */
export default (sequelize) => {
  class PayoutAccount extends Model {
    static associate(db) {
      PayoutAccount.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }

    /** What list rows and the wallet header show — never the full number. */
    get maskedIdentifier() {
      if (this.method === PayoutMethod.UPI) return this.upiId;
      const digits = this.accountNumber ?? '';
      return digits.length > 4 ? `•••• ${digits.slice(-4)}` : digits;
    }
  }

  PayoutAccount.init(
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
      method: {
        type: DataTypes.ENUM(...Object.values(PayoutMethod)),
        allowNull: false,
      },
      /** The name on the account, which staff match against KYC — not necessarily the store name. */
      accountHolderName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accountNumber: {
        type: DataTypes.STRING(34),
        allowNull: true,
      },
      ifscCode: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      upiId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      /** Exactly one per store should be true — the service clears the others when setting one. */
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'PayoutAccount',
      tableName: 'payout_accounts',
    }
  );

  return PayoutAccount;
};
