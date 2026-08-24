'use strict';

/**
 * One conversation between a customer and a store about a pet listing.
 *
 * One thread per (customer, pet_listing) — a customer asking about the
 * same puppy twice reopens the same thread rather than forking a second
 * one, which is also what lets the unique index below double as the
 * "does a thread already exist" check the service needs before creating.
 *
 * `store_id` is denormalized off `pet_listings.store_id` rather than
 * reached through a join on every inbox query, the same tradeoff
 * `pet_listings` itself documents for `age_label`: promote what a list
 * screen filters or sorts on. The partner inbox sorts by
 * `last_message_at` per store constantly; it would otherwise join
 * `pet_listings` on every page load for a value that never changes after
 * the thread opens (a listing does not switch stores).
 *
 * `last_message_at` / `last_message_from_partner` are the same kind of
 * denormalization for the same reason: the inbox list needs both on every
 * row it renders, and computing them from `messages` per row turns one
 * indexed sort into N per-thread subqueries.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('enquiries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /** Denormalized from pet_listings.store_id — see file comment. */
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pet_listing_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pet_listings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /**
       * From the partner's side of the conversation — a customer has no
       * equivalent workflow state, they are just talking to a store.
       * NEW on create; the partner's own replies/actions move it on from
       * there (see enquiryStatusMeta.ts on the partner app for the exact
       * label/color each maps to).
       */
      status: {
        type: Sequelize.ENUM('NEW', 'FOLLOW_UP', 'ACTIVE', 'RESERVED', 'CLOSED'),
        allowNull: false,
        defaultValue: 'NEW',
      },
      last_message_at: { type: Sequelize.DATE, allowNull: true },
      last_message_from_partner: { type: Sequelize.BOOLEAN, allowNull: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // One thread per customer+listing — also the existence check `findOrCreate` relies on.
    await queryInterface.addIndex('enquiries', ['customer_id', 'pet_listing_id'], {
      name: 'enquiries_customer_listing_unique',
      unique: true,
    });
    // The partner inbox: "my store's enquiries, newest activity first".
    await queryInterface.addIndex('enquiries', ['store_id', 'last_message_at'], {
      name: 'enquiries_store_last_message',
    });
    // The customer's own "my conversations" list.
    await queryInterface.addIndex('enquiries', ['customer_id', 'last_message_at'], {
      name: 'enquiries_customer_last_message',
    });

    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      enquiry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'enquiries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      /**
       * Which side sent it. Kept alongside sender_id (not derived from it)
       * so a read query never has to know which role a given user id holds
       * to render a bubble on the correct side.
       */
      sender_type: {
        type: Sequelize.ENUM('CUSTOMER', 'PARTNER'),
        allowNull: false,
      },
      /** The actual user who sent it — PARTNER_OWNER today, but PARTNER_MANAGER/STAFF read the same column once staff accounts exist. */
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      text: { type: Sequelize.TEXT, allowNull: false },
      /**
       * Null until the other side opens the thread. One column serves
       * both directions — whoever didn't send it is the one who reads
       * it — so this doubles as the customer's read receipt if that UI
       * is ever built, not just the partner's.
       */
      read_at: { type: Sequelize.DATE, allowNull: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Thread pagination, oldest-first — exactly the order the chat screens render in.
    await queryInterface.addIndex('messages', ['enquiry_id', 'created_at'], {
      name: 'messages_enquiry_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('enquiries');
  },
};
