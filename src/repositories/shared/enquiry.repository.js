import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Enquiry, Message, PetListing, PetListingMedia, Store, User } = db;

/** The listing card an enquiry pins above its thread — just what that card renders, not the whole row. */
const PET_LISTING_INCLUDE = {
  model: PetListing,
  as: 'petListing',
  attributes: ['id', 'name', 'priceInInr', 'status'],
  include: [{ model: PetListingMedia, as: 'media', attributes: ['url', 'isMain'] }],
};

const CUSTOMER_INCLUDE = { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] };
const STORE_INCLUDE = { model: Store, as: 'store', attributes: ['id', 'name', 'city'] };

/** Only place `enquiries` / `messages` are queried — services never touch the models directly. */
export const enquiryRepository = {
  /** One thread per (customer, listing) — the row `findOrCreateForCustomer` keys off. */
  findByCustomerAndListing({ customerId, petListingId }, options) {
    return Enquiry.findOne({ where: { customerId, petListingId }, ...options });
  },

  create(payload, options) {
    return Enquiry.create(payload, options);
  },

  /** The partner's inbox — every thread against this store, newest activity first. */
  findAndCountForStore({ storeId, status, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;

    return Enquiry.findAndCountAll({
      where,
      include: [
        PET_LISTING_INCLUDE,
        search
          ? { ...CUSTOMER_INCLUDE, where: { name: { [Op.like]: `%${search}%` } } }
          : CUSTOMER_INCLUDE,
      ],
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });
  },

  /** The customer's own "my conversations" list. */
  findAndCountForCustomer({ customerId, limit, offset }) {
    return Enquiry.findAndCountAll({
      where: { customerId },
      include: [PET_LISTING_INCLUDE, STORE_INCLUDE],
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset,
    });
  },

  /** One thread, scoped to the store that owns it — a partner can never open another kennel's conversation by guessing an id. */
  findByIdForStore({ id, storeId }) {
    return Enquiry.findOne({ where: { id, storeId }, include: [PET_LISTING_INCLUDE, CUSTOMER_INCLUDE] });
  },

  /** Same, scoped to the customer who opened it. */
  findByIdForCustomer({ id, customerId }) {
    return Enquiry.findOne({ where: { id, customerId }, include: [PET_LISTING_INCLUDE, STORE_INCLUDE] });
  },

  findById(id, options) {
    return Enquiry.findByPk(id, options);
  },

  update(enquiry, payload, options) {
    return enquiry.update(payload, options);
  },

  /** A thread's full history, oldest first — exactly the order every chat screen renders in. */
  findMessages({ enquiryId, limit, offset }) {
    return Message.findAndCountAll({
      where: { enquiryId },
      order: [['createdAt', 'ASC']],
      limit,
      offset,
    });
  },

  /** Just the newest message in a thread — what an inbox row previews. Separate from `findMessages`, whose order is oldest-first for the chat screen. */
  findLatestMessage(enquiryId) {
    return Message.findOne({ where: { enquiryId }, order: [['createdAt', 'DESC']] });
  },

  createMessage(payload, options) {
    return Message.create(payload, options);
  },

  /**
   * Marks every message the other side sent as read. `readerType` is
   * whoever is opening the thread now — a partner reading marks the
   * customer's messages, and vice versa — so this one query serves both
   * `markRead` endpoints.
   */
  markMessagesRead({ enquiryId, readerIsPartner }, options) {
    return Message.update(
      { readAt: new Date() },
      {
        where: {
          enquiryId,
          senderType: readerIsPartner ? 'CUSTOMER' : 'PARTNER',
          readAt: null,
        },
        ...options,
      }
    );
  },

  /** Unread-from-the-partner's-view count, per enquiry id — one grouped query for a whole inbox page rather than one COUNT per row. */
  async countUnreadForPartnerByEnquiryIds(enquiryIds) {
    if (!enquiryIds.length) return {};

    const rows = await Message.findAll({
      where: { enquiryId: { [Op.in]: enquiryIds }, senderType: 'CUSTOMER', readAt: null },
      attributes: ['enquiryId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['enquiryId'],
      raw: true,
    });

    return Object.fromEntries(rows.map((row) => [row.enquiryId, Number(row.count)]));
  },

  /** Same, from the customer's side — unread-from-the-customer's-view count per enquiry id. */
  async countUnreadForCustomerByEnquiryIds(enquiryIds) {
    if (!enquiryIds.length) return {};

    const rows = await Message.findAll({
      where: { enquiryId: { [Op.in]: enquiryIds }, senderType: 'PARTNER', readAt: null },
      attributes: ['enquiryId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['enquiryId'],
      raw: true,
    });

    return Object.fromEntries(rows.map((row) => [row.enquiryId, Number(row.count)]));
  },
};
