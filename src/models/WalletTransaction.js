import { DataTypes, Model } from 'sequelize';

import { WalletReferenceType, WalletTransactionStatus, WalletTransactionType } from '../config/constants.js';

/**
 * One row of a partner's append-only ledger (PRODUCT_CONTEXT.md §5).
 *
 * There is no balance column anywhere. A partner's balance is the sum of
 * their COMPLETED rows, computed on read — which is what lets a disputed
 * order be corrected by *adding* a REFUND row while the history still
 * explains how the number got where it is. A stored balance would let the
 * two disagree, and only one of them would be auditable.
 *
 * Rows are written by lifecycle transitions, never by the partner: an
 * order reaching DELIVERED and a booking reaching COMPLETED each write one
 * EARNING (§7).
 */
export default (sequelize) => {
  class WalletTransaction extends Model {
    static associate(db) {
      WalletTransaction.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
    }

    /** How this row moves the balance. `amountInInr` is always positive; direction is `type`'s job alone. */
    get signedAmountInInr() {
      return this.type === WalletTransactionType.EARNING ? this.amountInInr : -this.amountInInr;
    }
  }

  WalletTransaction.init(
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
      type: {
        type: DataTypes.ENUM(...Object.values(WalletTransactionType)),
        allowNull: false,
      },
      /** Always positive — a signed amount plus a type would let the two disagree. */
      amountInInr: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 },
      },
      /**
       * What this row came from. Not a foreign key: it points at three
       * different tables depending on `referenceType`, and one column
       * cannot reference three. Null for a manual adjustment.
       */
      referenceType: {
        type: DataTypes.ENUM(...Object.values(WalletReferenceType)),
        allowNull: true,
      },
      referenceId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(WalletTransactionStatus)),
        allowNull: false,
        defaultValue: WalletTransactionStatus.PENDING,
      },
      /** Free text on the transaction detail screen — "Order PTZ-4821", "Weekly payout". */
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'WalletTransaction',
      tableName: 'wallet_transactions',
    }
  );

  return WalletTransaction;
};
