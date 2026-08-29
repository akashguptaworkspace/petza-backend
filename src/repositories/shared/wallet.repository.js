import db from '../../models/index.js';
import { WalletTransactionStatus, WalletTransactionType } from '../../config/constants.js';

const { PayoutAccount, WalletTransaction } = db;

/** Only place `wallet_transactions` and `payout_accounts` are queried. */
export const walletRepository = {
  findAndCountTransactions({ storeId, type, limit, offset }) {
    const where = { storeId };
    if (type) where.type = type;

    return WalletTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  },

  findTransactionById({ id, storeId }) {
    return WalletTransaction.findOne({ where: { id, storeId } });
  },

  /**
   * Totals per (type, status), which is everything the wallet header needs
   * in one grouped query.
   *
   * There is no balance column — a balance and a ledger can disagree, and
   * only one of them is auditable — so the header is always derived from
   * exactly these sums (see the WalletTransaction model).
   */
  async sumByTypeAndStatus(storeId) {
    const rows = await WalletTransaction.findAll({
      where: { storeId },
      attributes: [
        'type',
        'status',
        [WalletTransaction.sequelize.fn('SUM', WalletTransaction.sequelize.col('amount_in_inr')), 'total'],
      ],
      group: ['type', 'status'],
      raw: true,
    });

    const totals = {};
    for (const row of rows) {
      totals[`${row.type}:${row.status}`] = Number(row.total) || 0;
    }
    return totals;
  },

  /** The most recent completed payout, for the "last paid out" line. */
  findLastPayout(storeId) {
    return WalletTransaction.findOne({
      where: { storeId, type: WalletTransactionType.PAYOUT, status: WalletTransactionStatus.COMPLETED },
      order: [['createdAt', 'DESC']],
    });
  },

  createTransaction(payload, options) {
    return WalletTransaction.create(payload, options);
  },

  findPayoutAccounts(storeId) {
    return PayoutAccount.findAll({
      where: { storeId },
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
  },

  findDefaultPayoutAccount(storeId) {
    return PayoutAccount.findOne({ where: { storeId, isDefault: true } });
  },

  createPayoutAccount(payload, options) {
    return PayoutAccount.create(payload, options);
  },

  /** Exactly one default per store — clearing the others is what keeps that true. */
  clearDefaultPayoutAccounts(storeId, options) {
    return PayoutAccount.update({ isDefault: false }, { where: { storeId }, ...options });
  },
};
