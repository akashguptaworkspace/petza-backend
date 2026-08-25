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
/** The counterpart on a thread about a privately-listed pet — the store's opposite number. */
const OWNER_INCLUDE = { model: User, as: 'individualOwner', attributes: ['id', 'name'] };

/**
 * Everyone a customer-app read might need to name. Both possible sellers
 * (exactly one resolves, matching whichever column owns the thread) plus
 * the buyer — because the same rows are now read by *both* ends when the
 * seller is an individual, and a private seller's inbox has to show who is
 * asking, not their own name.
 */
const CUSTOMER_SIDE_INCLUDE = [PET_LISTING_INCLUDE, STORE_INCLUDE, OWNER_INCLUDE, CUSTOMER_INCLUDE];

/**
 * Either end of a privately-sold pet. A user is a party to a thread when
 * they opened it OR when they own the listing it is about — the customer
 * app serves both, since a private seller is an ordinary account with no
 * store and no partner login.
 */
function partyToThread(userId) {
  return { [Op.or]: [{ customerId: userId }, { individualOwnerId: userId }] };
}

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

  /** "My conversations" — threads this user opened, and threads about pets they listed. */
  findAndCountForCustomer({ userId, limit, offset }) {
    return Enquiry.findAndCountAll({
      where: partyToThread(userId),
      include: CUSTOMER_SIDE_INCLUDE,
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset,
    });
  },

  /** One thread, scoped to the store that owns it — a partner can never open another kennel's conversation by guessing an id. */
  findByIdForStore({ id, storeId }) {
    return Enquiry.findOne({ where: { id, storeId }, include: [PET_LISTING_INCLUDE, CUSTOMER_INCLUDE] });
  },

  /** Same, scoped to either party — the buyer who opened it or the individual who owns the listing. */
  findByIdForCustomer({ id, userId }) {
    return Enquiry.findOne({ where: { id, ...partyToThread(userId) }, include: CUSTOMER_SIDE_INCLUDE });
  },

  /** Does this thread belong to this store? The partner-side half of the socket server's room check. */
  async isThreadOfStore({ enquiryId, storeId }) {
    const count = await Enquiry.count({ where: { id: enquiryId, storeId } });
    return count > 0;
  },

  /** Is this user a party to this thread? Used by the socket server before it lets a connection into a thread room. */
  async isPartyToThread({ enquiryId, userId }) {
    const count = await Enquiry.count({ where: { id: enquiryId, ...partyToThread(userId) } });
    return count > 0;
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

  /**
   * Unread count per enquiry id, from the point of view of whoever is NOT
   * `senderType`. Takes the sender rather than assuming 'PARTNER', because
   * a private seller reading their own inbox is unread on the CUSTOMER's
   * messages — the same rows, counted from the other end.
   */
  async countUnreadByEnquiryIds(enquiryIds, senderType) {
    if (!enquiryIds.length) return {};

    const rows = await Message.findAll({
      where: { enquiryId: { [Op.in]: enquiryIds }, senderType, readAt: null },
      attributes: ['enquiryId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['enquiryId'],
      raw: true,
    });

    return Object.fromEntries(rows.map((row) => [row.enquiryId, Number(row.count)]));
  },

  /**
   * How many messages buyers have sent about each listing — what an owner's
   * "N messages" counter reads.
   *
   * Counts CUSTOMER-sent messages only: a seller's own replies are not
   * enquiries they received, and including them would make the number climb
   * every time they answered one.
   */
  async countCustomerMessagesByListingIds(petListingIds) {
    if (!petListingIds.length) return {};

    const rows = await Message.findAll({
      where: { senderType: 'CUSTOMER' },
      include: [
        {
          model: Enquiry,
          as: 'enquiry',
          attributes: [],
          where: { petListingId: { [Op.in]: petListingIds } },
          required: true,
        },
      ],
      attributes: [
        [db.sequelize.col('enquiry.pet_listing_id'), 'petListingId'],
        [db.sequelize.fn('COUNT', db.sequelize.col('Message.id')), 'count'],
      ],
      group: [db.sequelize.col('enquiry.pet_listing_id')],
      raw: true,
    });

    return Object.fromEntries(rows.map((row) => [row.petListingId, Number(row.count)]));
  },
};
