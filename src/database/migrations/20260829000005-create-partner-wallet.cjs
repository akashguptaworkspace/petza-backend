'use strict';

/**
 * The Wallet tab's data — PRODUCT_CONTEXT.md §5.
 *
 * `wallet_transactions` is an append-only ledger, not a balance: a
 * partner's balance is the sum of their COMPLETED rows, never a column
 * that gets incremented. That way a disputed order is corrected by adding
 * a REFUND row, and the history still explains how the number got there.
 *
 * Rows are written by lifecycle transitions, not by the partner: an order
 * reaching DELIVERED and a booking reaching COMPLETED each write one
 * EARNING (§7). PAYOUT rows are written when a withdrawal is requested and
 * flipped to COMPLETED when finance approves it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    };

    await queryInterface.createTable('wallet_transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.ENUM('EARNING', 'PAYOUT', 'REFUND'), allowNull: false },
      /**
       * Always positive. Which way it moves the balance is `type`'s job —
       * a signed amount plus a type would let the two disagree.
       */
      amount_in_inr: { type: Sequelize.INTEGER, allowNull: false },
      /**
       * What this row came from. Not a foreign key: it points at three
       * different tables depending on `reference_type`, and one column
       * cannot reference three. Null for a manual adjustment.
       */
      reference_type: { type: Sequelize.ENUM('ORDER', 'BOOKING', 'PAYOUT_REQUEST'), allowNull: true },
      reference_id: { type: Sequelize.UUID, allowNull: true },
      status: {
        type: Sequelize.ENUM('PENDING', 'COMPLETED', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      /** Free text shown on the transaction detail screen — "Order PTZ-4821", "Weekly payout". */
      note: { type: Sequelize.STRING, allowNull: true },
      ...timestamps,
    });

    // Transaction history: this store's ledger, newest first.
    await queryInterface.addIndex('wallet_transactions', ['store_id', 'created_at'], {
      name: 'wallet_transactions_store_created',
    });
    // Balance is SUM(amount) grouped by type over COMPLETED rows.
    await queryInterface.addIndex('wallet_transactions', ['store_id', 'status', 'type'], {
      name: 'wallet_transactions_store_status_type',
    });
    await queryInterface.addIndex('wallet_transactions', ['reference_type', 'reference_id'], {
      name: 'wallet_transactions_reference',
    });

    await queryInterface.createTable('payout_accounts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Decides which of the two column groups below is filled; the other stays null. */
      method: { type: Sequelize.ENUM('BANK', 'UPI'), allowNull: false },
      /** The name on the account, which staff match against KYC — not necessarily the store name. */
      account_holder_name: { type: Sequelize.STRING, allowNull: true },
      /** Stored as given. Screens mask all but the last four; the database keeps the whole thing because payouts need it. */
      account_number: { type: Sequelize.STRING(34), allowNull: true },
      ifsc_code: { type: Sequelize.STRING(16), allowNull: true },
      upi_id: { type: Sequelize.STRING(120), allowNull: true },
      /** Exactly one per store should be true; the service clears the others when setting one. */
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps,
    });

    await queryInterface.addIndex('payout_accounts', ['store_id', 'is_default'], {
      name: 'payout_accounts_store_default',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payout_accounts');
    await queryInterface.dropTable('wallet_transactions');
  },
};
