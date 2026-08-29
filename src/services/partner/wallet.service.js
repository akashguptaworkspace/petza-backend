import {
  PayoutMethod,
  WalletReferenceType,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { walletRepository } from '../../repositories/shared/wallet.repository.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * The Wallet tab — PRODUCT_CONTEXT.md §6.
 *
 * Every figure here is computed from the ledger, never stored. See the
 * WalletTransaction model for why: a balance column and an append-only
 * ledger can disagree, and only one of the two can be audited afterwards.
 *
 * Withdrawals are the one place this service *writes*, and what it writes
 * is a PENDING PAYOUT row — money leaving is a request until finance
 * approves it, so the row exists (and is subtracted from the available
 * balance) from the moment it is asked for.
 */

/** Below this a payout costs more to process than it moves. */
const MINIMUM_WITHDRAWAL_INR = 500;

async function computeSummary(storeId) {
  const [totals, lastPayout] = await Promise.all([
    walletRepository.sumByTypeAndStatus(storeId),
    walletRepository.findLastPayout(storeId),
  ]);

  const at = (type, status) => totals[`${type}:${status}`] ?? 0;

  const earned = at(WalletTransactionType.EARNING, WalletTransactionStatus.COMPLETED);
  const paidOut = at(WalletTransactionType.PAYOUT, WalletTransactionStatus.COMPLETED);
  const refunded = at(WalletTransactionType.REFUND, WalletTransactionStatus.COMPLETED);
  // A requested-but-unapproved payout is already spoken for, so it comes
  // out of the available balance rather than sitting in it.
  const payoutInFlight = at(WalletTransactionType.PAYOUT, WalletTransactionStatus.PENDING);

  return {
    availableBalanceInInr: earned - paidOut - refunded - payoutInFlight,
    /** Earnings not yet cleared, plus payouts awaiting approval. */
    pendingBalanceInInr: at(WalletTransactionType.EARNING, WalletTransactionStatus.PENDING) + payoutInFlight,
    lifetimeEarningsInInr: earned,
    lastPayoutAt: lastPayout?.createdAt ?? null,
  };
}

export const partnerWalletService = {
  getSummary(storeId) {
    return computeSummary(storeId);
  },

  async listTransactions({ storeId, type, page = 1, limit = 20 }) {
    const { rows, count } = await walletRepository.findAndCountTransactions({
      storeId,
      type,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows.map(toTransactionDto),
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
    };
  },

  async getTransaction({ storeId, id }) {
    const transaction = await walletRepository.findTransactionById({ id, storeId });
    if (!transaction) throw new NotFoundError('Transaction not found');
    return toTransactionDto(transaction);
  },

  async listPayoutAccounts(storeId) {
    const accounts = await walletRepository.findPayoutAccounts(storeId);
    return accounts.map(toPayoutAccountDto);
  },

  /**
   * Adds a payout destination. The first one a partner adds becomes their
   * default automatically — a store with accounts but no default would
   * make every withdrawal ask a question it already knows the answer to.
   */
  async addPayoutAccount({ storeId, payload }) {
    if (payload.method === PayoutMethod.UPI && !payload.upiId) {
      throw new BadRequestError('Enter your UPI ID');
    }
    if (payload.method === PayoutMethod.BANK && !(payload.accountNumber && payload.ifscCode)) {
      throw new BadRequestError('Enter both the account number and the IFSC code');
    }

    const existing = await walletRepository.findPayoutAccounts(storeId);
    const shouldBeDefault = payload.isDefault || existing.length === 0;

    const account = await sequelize.transaction(async (transaction) => {
      if (shouldBeDefault) await walletRepository.clearDefaultPayoutAccounts(storeId, { transaction });
      return walletRepository.createPayoutAccount(
        {
          storeId,
          method: payload.method,
          accountHolderName: payload.accountHolderName ?? null,
          accountNumber: payload.accountNumber ?? null,
          ifscCode: payload.ifscCode ?? null,
          upiId: payload.upiId ?? null,
          isDefault: shouldBeDefault,
        },
        { transaction }
      );
    });

    return toPayoutAccountDto(account);
  },

  /**
   * The withdraw sheet's submit.
   *
   * Writes a PENDING row rather than moving money: finance approves it in
   * the admin console, and only that flips it to COMPLETED. The balance
   * check happens against the *live* summary, which already nets out other
   * in-flight requests, so two withdrawals in quick succession cannot
   * together overdraw.
   */
  async requestWithdrawal({ storeId, amountInInr }) {
    if (amountInInr < MINIMUM_WITHDRAWAL_INR) {
      throw new BadRequestError(`The minimum withdrawal is ₹${MINIMUM_WITHDRAWAL_INR}`);
    }

    const account = await walletRepository.findDefaultPayoutAccount(storeId);
    if (!account) throw new BadRequestError('Add a payout account before withdrawing');

    const summary = await computeSummary(storeId);
    if (amountInInr > summary.availableBalanceInInr) {
      throw new BadRequestError(`You have ₹${summary.availableBalanceInInr} available`);
    }

    const created = await walletRepository.createTransaction({
      storeId,
      type: WalletTransactionType.PAYOUT,
      amountInInr,
      referenceType: WalletReferenceType.PAYOUT_REQUEST,
      referenceId: account.id,
      status: WalletTransactionStatus.PENDING,
      note: `Withdrawal to ${account.maskedIdentifier}`,
    });

    return { transaction: toTransactionDto(created), summary: await computeSummary(storeId) };
  },
};

function toTransactionDto(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amountInInr: transaction.amountInInr,
    status: transaction.status,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    note: transaction.note,
    createdAt: transaction.createdAt,
  };
}

function toPayoutAccountDto(account) {
  return {
    id: account.id,
    method: account.method,
    accountHolderName: account.accountHolderName,
    // The full number never leaves the server.
    maskedIdentifier: account.maskedIdentifier,
    isDefault: account.isDefault,
  };
}
