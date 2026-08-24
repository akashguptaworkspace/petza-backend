import { EnquiryStatus, MessageSenderType } from '../../config/constants.js';
import { enquiryRepository } from '../../repositories/shared/enquiry.repository.js';
import { petListingRepository } from '../../repositories/shared/petListing.repository.js';
import { emitEnquiryCreated, emitEnquiryMessage, emitEnquiryUpdated, isCustomerOnline } from '../../realtime/socketServer.js';
import { sequelize } from '../../models/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * The enquiry/chat data access shared by both apps — a customer's "message
 * this seller" and a partner's inbox are the same rows, read through two
 * different scopes (`forCustomer`/`forStore`), never two different tables.
 *
 * `petMediaUrl`'s stored value is already a full `/uploads/...` path (see
 * `petListingRepository`'s media rows), so DTOs below pass it through as-is
 * rather than re-deriving it — `petMediaUrl` only builds that path once, at
 * upload time.
 */

function mainPhotoUrl(petListing) {
  const media = petListing?.media ?? [];
  const main = media.find((item) => item.isMain) ?? media[0];
  return main?.url ?? null;
}

/** The inbox row — one per thread, shaped exactly like petza-partner's `KennelEnquiry`. */
function toPartnerInboxDto(enquiry, { unreadCount, lastMessage }) {
  return {
    id: enquiry.id,
    customerName: enquiry.customer?.name ?? 'Petza customer',
    // No address book yet — a customer's city isn't collected anywhere in
    // the schema today, so this is the one field the DTO cannot fill in
    // honestly. Empty rather than invented; the UI already treats a blank
    // string as "omit this line".
    customerCity: '',
    petId: enquiry.petListingId,
    petName: enquiry.petListing?.name ?? 'Listing removed',
    petImageUrl: mainPhotoUrl(enquiry.petListing),
    lastMessage: lastMessage?.text ?? '',
    lastMessageFromPartner: enquiry.lastMessageFromPartner ?? false,
    lastMessageAt: enquiry.lastMessageAt,
    status: enquiry.status,
    unreadCount,
  };
}

/** One open conversation — shaped exactly like petza-partner's `EnquiryThread`. */
function toPartnerThreadDto(enquiry, messages) {
  const online = isCustomerOnline(enquiry.customerId);
  return {
    id: enquiry.id,
    customerId: enquiry.customerId,
    customerName: enquiry.customer?.name ?? 'Petza customer',
    customerCity: '',
    // Real presence — whether the customer has a live socket connection
    // right now (realtime/socketServer.js), not a guess from message age.
    // `lastSeenAt` only matters when they're offline; while online it's
    // simply "now", since the header shows "Active now" instead of reading it.
    isCustomerOnline: online,
    lastSeenAt: online ? new Date().toISOString() : (lastCustomerMessageAt(messages) ?? enquiry.updatedAt),
    pet: {
      id: enquiry.petListingId,
      name: enquiry.petListing?.name ?? 'Listing removed',
      imageUrl: mainPhotoUrl(enquiry.petListing),
      priceInInr: enquiry.petListing?.priceInInr ?? 0,
      status: enquiry.petListing?.status ?? 'ARCHIVED',
    },
    messages: messages.map(toMessageDto),
  };
}

/** The customer app's inbox row and thread use the mirror image of the same shape — store instead of pet-as-headline, no unread math the partner side needs. */
function toCustomerInboxDto(enquiry, { unreadCount, lastMessage }) {
  return {
    id: enquiry.id,
    storeId: enquiry.storeId,
    storeName: enquiry.store?.name ?? 'Seller',
    petId: enquiry.petListingId,
    petName: enquiry.petListing?.name ?? 'Listing removed',
    petImageUrl: mainPhotoUrl(enquiry.petListing),
    lastMessage: lastMessage?.text ?? '',
    lastMessageFromCustomer: !enquiry.lastMessageFromPartner,
    lastMessageAt: enquiry.lastMessageAt,
    unreadCount,
  };
}

function toCustomerThreadDto(enquiry, messages) {
  return {
    id: enquiry.id,
    storeId: enquiry.storeId,
    storeName: enquiry.store?.name ?? 'Seller',
    pet: {
      id: enquiry.petListingId,
      name: enquiry.petListing?.name ?? 'Listing removed',
      imageUrl: mainPhotoUrl(enquiry.petListing),
      priceInInr: enquiry.petListing?.priceInInr ?? 0,
      status: enquiry.petListing?.status ?? 'ARCHIVED',
    },
    messages: messages.map(toMessageDto),
  };
}

function toMessageDto(message) {
  const fromPartner = message.senderType === MessageSenderType.PARTNER;
  return {
    id: message.id,
    text: message.text,
    sentAt: message.createdAt,
    fromPartner,
    // `read_at` serves both directions (see the create-enquiries migration:
    // "whoever isn't the sender read it") — a partner-sent message's own
    // read state is `readByCustomer`, the customer app's double-tick; a
    // customer-sent message's is `readByPartner`, the same tick for
    // petza-partner's own thread screen. Exactly one of the two is ever
    // meaningful per message, so the other stays undefined rather than a
    // fabricated `false` a bubble might render as "sent but never read".
    readByCustomer: fromPartner ? message.readAt != null : undefined,
    readByPartner: fromPartner ? undefined : message.readAt != null,
  };
}

/**
 * The socket payload adds `enquiryId` on top of the REST message DTO — a
 * client can be joined to several thread rooms in the inbox at once, and
 * Socket.IO's event listener has no way to ask "which room did this arrive
 * on", so the message carries its own thread id rather than relying on that.
 */
function toLiveMessagePayload(enquiryId, message) {
  return { ...toMessageDto(message), enquiryId };
}

function lastCustomerMessageAt(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].senderType === MessageSenderType.CUSTOMER) return messages[i].createdAt;
  }
  return null;
}


export const enquiryService = {
  /**
   * Opens (or reopens) the thread a customer's "message the seller" button
   * starts, and posts their first message into it in the same transaction —
   * a thread that exists with nothing said in it isn't a useful state to
   * leave half-created.
   */
  async startFromCustomer({ customerId, petListingId, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new BadRequestError('Message cannot be empty');

    // Any listing the customer could plausibly be looking at right now —
    // wider than the public catalogue's own AVAILABLE/RESERVED filter, so a
    // conversation already underway doesn't break the moment a pet sells.
    const listing = await petListingRepository.findOnePublic({
      idOrSlug: petListingId,
      statuses: ['AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE'],
    });
    if (!listing) throw new NotFoundError('Listing not found');

    const { enquiry, message, isNewThread } = await sequelize.transaction(async (transaction) => {
      let thread = await enquiryRepository.findByCustomerAndListing(
        { customerId, petListingId: listing.id },
        { transaction }
      );
      const isNew = !thread;

      if (!thread) {
        thread = await enquiryRepository.create(
          { customerId, storeId: listing.storeId, petListingId: listing.id, status: EnquiryStatus.NEW },
          { transaction }
        );
      }

      const created = await enquiryRepository.createMessage(
        { enquiryId: thread.id, senderType: MessageSenderType.CUSTOMER, senderId: customerId, text: trimmed },
        { transaction }
      );

      await enquiryRepository.update(
        thread,
        { lastMessageAt: created.createdAt, lastMessageFromPartner: false },
        { transaction }
      );

      return { enquiry: thread, message: created, isNewThread: isNew };
    });

    if (isNewThread) {
      // No socket has joined `enquiry:<id>` yet for a thread that didn't
      // exist a moment ago — the store-wide room is what reaches the
      // partner's inbox instead. An existing thread's message still also
      // goes to `emitEnquiryMessage` below, exactly as any other reply does.
      emitEnquiryCreated(enquiry.storeId, { enquiryId: enquiry.id });
    }

    emitEnquiryMessage(
      enquiry.id,
      { storeId: enquiry.storeId, customerId: enquiry.customerId },
      toLiveMessagePayload(enquiry.id, message)
    );
    emitEnquiryUpdated(enquiry.id, { id: enquiry.id, status: enquiry.status, lastMessageAt: message.createdAt });

    return { enquiryId: enquiry.id };
  },

  // ---- Partner side ----

  async listForStore({ storeId, status, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await enquiryRepository.findAndCountForStore({ storeId, status, search, limit, offset });

    const unreadByEnquiry = await enquiryRepository.countUnreadForPartnerByEnquiryIds(rows.map((row) => row.id));
    const items = await Promise.all(
      rows.map(async (row) => {
        const lastMessage = await enquiryRepository.findLatestMessage(row.id);
        return toPartnerInboxDto(row, { unreadCount: unreadByEnquiry[row.id] ?? 0, lastMessage });
      })
    );

    return { items, meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) } };
  },

  async getThreadForStore({ id, storeId }) {
    const enquiry = await enquiryRepository.findByIdForStore({ id, storeId });
    if (!enquiry) throw new NotFoundError('Enquiry not found');

    const { rows: messages } = await enquiryRepository.findMessages({ enquiryId: id, limit: 500, offset: 0 });
    return toPartnerThreadDto(enquiry, messages);
  },

  async replyFromPartner({ enquiryId, storeId, senderId, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new BadRequestError('Message cannot be empty');

    const enquiry = await enquiryRepository.findByIdForStore({ id: enquiryId, storeId });
    if (!enquiry) throw new NotFoundError('Enquiry not found');

    const message = await sequelize.transaction(async (transaction) => {
      const created = await enquiryRepository.createMessage(
        { enquiryId, senderType: MessageSenderType.PARTNER, senderId, text: trimmed },
        { transaction }
      );

      // A reply is also the partner acting on the enquiry — NEW moves to
      // ACTIVE the moment they say anything back, the same way the partner
      // app's own status legend describes "Active chat".
      const nextStatus = enquiry.status === EnquiryStatus.NEW ? EnquiryStatus.ACTIVE : enquiry.status;

      await enquiryRepository.update(
        enquiry,
        { lastMessageAt: created.createdAt, lastMessageFromPartner: true, status: nextStatus },
        { transaction }
      );

      return created;
    });

    emitEnquiryMessage(
      enquiryId,
      { storeId: enquiry.storeId, customerId: enquiry.customerId },
      toLiveMessagePayload(enquiryId, message)
    );
    emitEnquiryUpdated(enquiryId, { id: enquiryId, status: enquiry.status, lastMessageAt: message.createdAt });

    return toMessageDto(message);
  },

  /** Clears the partner's unread badge on this thread — called when the inbox card is opened, not on a per-message basis. */
  async markReadByPartner({ enquiryId, storeId }) {
    const enquiry = await enquiryRepository.findByIdForStore({ id: enquiryId, storeId });
    if (!enquiry) throw new NotFoundError('Enquiry not found');

    await enquiryRepository.markMessagesRead({ enquiryId, readerIsPartner: true });
    emitEnquiryUpdated(enquiryId, { id: enquiryId, readByPartner: true });

    const [unreadByEnquiry, lastMessage] = await Promise.all([
      enquiryRepository.countUnreadForPartnerByEnquiryIds([enquiryId]),
      enquiryRepository.findLatestMessage(enquiryId),
    ]);
    return toPartnerInboxDto(enquiry, { unreadCount: unreadByEnquiry[enquiryId] ?? 0, lastMessage });
  },

  async updateStatusForStore({ enquiryId, storeId, status }) {
    if (!Object.values(EnquiryStatus).includes(status)) throw new BadRequestError('Invalid status');

    const enquiry = await enquiryRepository.findByIdForStore({ id: enquiryId, storeId });
    if (!enquiry) throw new NotFoundError('Enquiry not found');

    await enquiryRepository.update(enquiry, { status });
    emitEnquiryUpdated(enquiryId, { id: enquiryId, status });

    const [unreadByEnquiry, lastMessage] = await Promise.all([
      enquiryRepository.countUnreadForPartnerByEnquiryIds([enquiryId]),
      enquiryRepository.findLatestMessage(enquiryId),
    ]);
    return toPartnerInboxDto(enquiry, { unreadCount: unreadByEnquiry[enquiryId] ?? 0, lastMessage });
  },

  // ---- Customer side ----

  async listForCustomer({ customerId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await enquiryRepository.findAndCountForCustomer({ customerId, limit, offset });

    const unreadByEnquiry = await enquiryRepository.countUnreadForCustomerByEnquiryIds(rows.map((row) => row.id));
    const items = await Promise.all(
      rows.map(async (row) => {
        const lastMessage = await enquiryRepository.findLatestMessage(row.id);
        return toCustomerInboxDto(row, { unreadCount: unreadByEnquiry[row.id] ?? 0, lastMessage });
      })
    );

    return { items, meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) } };
  },

  async getThreadForCustomer({ id, customerId }) {
    const enquiry = await enquiryRepository.findByIdForCustomer({ id, customerId });
    if (!enquiry) throw new NotFoundError('Conversation not found');

    const { rows: messages } = await enquiryRepository.findMessages({ enquiryId: id, limit: 500, offset: 0 });
    return toCustomerThreadDto(enquiry, messages);
  },

  async sendFromCustomer({ enquiryId, customerId, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new BadRequestError('Message cannot be empty');

    const enquiry = await enquiryRepository.findByIdForCustomer({ id: enquiryId, customerId });
    if (!enquiry) throw new NotFoundError('Conversation not found');
    if (enquiry.status === EnquiryStatus.CLOSED) throw new ForbiddenError('This conversation is closed');

    const message = await sequelize.transaction(async (transaction) => {
      const created = await enquiryRepository.createMessage(
        { enquiryId, senderType: MessageSenderType.CUSTOMER, senderId: customerId, text: trimmed },
        { transaction }
      );
      await enquiryRepository.update(enquiry, { lastMessageAt: created.createdAt, lastMessageFromPartner: false }, { transaction });
      return created;
    });

    emitEnquiryMessage(
      enquiryId,
      { storeId: enquiry.storeId, customerId },
      toLiveMessagePayload(enquiryId, message)
    );
    emitEnquiryUpdated(enquiryId, { id: enquiryId, lastMessageAt: message.createdAt });

    return toMessageDto(message);
  },

  async markReadByCustomer({ enquiryId, customerId }) {
    const enquiry = await enquiryRepository.findByIdForCustomer({ id: enquiryId, customerId });
    if (!enquiry) throw new NotFoundError('Conversation not found');

    await enquiryRepository.markMessagesRead({ enquiryId, readerIsPartner: false });
    emitEnquiryUpdated(enquiryId, { id: enquiryId, readByCustomer: true });
  },
};
