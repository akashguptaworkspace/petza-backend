import { EnquiryStatus, EnquiryViewerRole, MessageSenderType } from '../../config/constants.js';
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

/**
 * Which end of a thread is looking at it. A private seller is an ordinary
 * customer account — no store, no partner login — so both ends of a
 * user-to-user conversation are served by the same `/enquiries` surface,
 * and every DTO below has to be told which one is asking.
 */
function viewerRoleOf(enquiry, userId) {
  return enquiry.individualOwnerId && enquiry.individualOwnerId === userId
    ? EnquiryViewerRole.SELLER
    : EnquiryViewerRole.BUYER;
}

/**
 * Who owns the selling side of a thread. A thread hangs off a store OR off
 * the person who listed the pet, so this resolves whichever owns it.
 *
 * `storeId` stays null for a private seller rather than being filled with
 * the user's id: the app routes a store id to `/store/[id]`, and pointing
 * that at a user would 404. `sellerType` is what a client branches on.
 */
function sellerOf(enquiry) {
  if (enquiry.individualOwnerId) {
    return {
      sellerType: 'INDIVIDUAL',
      sellerId: enquiry.individualOwnerId,
      sellerName: enquiry.individualOwner?.name ?? 'Seller',
      storeId: null,
    };
  }
  return {
    sellerType: 'STORE',
    sellerId: enquiry.storeId,
    sellerName: enquiry.store?.name ?? 'Seller',
    storeId: enquiry.storeId,
  };
}

/**
 * The other party, from the viewer's side. A buyer sees the seller; a
 * private seller sees the buyer. Without this the seller's own inbox
 * listed their own name against every conversation.
 */
function counterpartOf(enquiry, viewerRole) {
  if (viewerRole === EnquiryViewerRole.SELLER) {
    return {
      counterpartType: 'CUSTOMER',
      counterpartId: enquiry.customerId,
      counterpartName: enquiry.customer?.name ?? 'Petza customer',
    };
  }

  const seller = sellerOf(enquiry);
  return {
    counterpartType: seller.sellerType,
    counterpartId: seller.sellerId,
    counterpartName: seller.sellerName,
  };
}

/** Was the newest message written by whoever is reading this row? Drives the "You: " prefix. */
function lastMessageIsMine(enquiry, viewerRole) {
  const fromSellerSide = enquiry.lastMessageFromPartner ?? false;
  return viewerRole === EnquiryViewerRole.SELLER ? fromSellerSide : !fromSellerSide;
}

function toCustomerInboxDto(enquiry, { unreadCount, lastMessage, viewerRole }) {
  return {
    id: enquiry.id,
    viewerRole,
    ...sellerOf(enquiry),
    ...counterpartOf(enquiry, viewerRole),
    // Kept so existing clients keep rendering a name; `counterpartName` is
    // the one to read going forward.
    storeName: sellerOf(enquiry).sellerName,
    petId: enquiry.petListingId,
    petName: enquiry.petListing?.name ?? 'Listing removed',
    petImageUrl: mainPhotoUrl(enquiry.petListing),
    lastMessage: lastMessage?.text ?? '',
    lastMessageFromMe: lastMessageIsMine(enquiry, viewerRole),
    lastMessageAt: enquiry.lastMessageAt,
    unreadCount,
  };
}

function toCustomerThreadDto(enquiry, messages, viewerRole) {
  return {
    id: enquiry.id,
    viewerRole,
    ...sellerOf(enquiry),
    ...counterpartOf(enquiry, viewerRole),
    storeName: sellerOf(enquiry).sellerName,
    pet: {
      id: enquiry.petListingId,
      name: enquiry.petListing?.name ?? 'Listing removed',
      imageUrl: mainPhotoUrl(enquiry.petListing),
      priceInInr: enquiry.petListing?.priceInInr ?? 0,
      status: enquiry.petListing?.status ?? 'ARCHIVED',
    },
    messages: messages.map((message) => toMessageDto(message, viewerRole)),
  };
}

function toMessageDto(message, viewerRole) {
  const fromPartner = message.senderType === MessageSenderType.PARTNER;
  return {
    id: message.id,
    /**
     * Whether the *reader* wrote this. `fromPartner` alone can't answer
     * that any more: on a user-to-user thread the seller side is also a
     * customer account, so their own replies come back `fromPartner: true`
     * and a bubble keyed on it would render everything they said as if the
     * other person had said it.
     *
     * Undefined when no viewer is in scope (the partner app's own DTO),
     * which is exactly when `fromPartner` is unambiguous on its own.
     */
    fromMe: viewerRole ? (viewerRole === EnquiryViewerRole.SELLER) === fromPartner : undefined,
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
        // Whichever side owns the listing owns the thread. Both are read
        // off the listing, never from the request — a client cannot open a
        // conversation against a store or a person of its choosing.
        thread = await enquiryRepository.create(
          {
            customerId,
            storeId: listing.storeId ?? null,
            individualOwnerId: listing.individualOwnerId ?? null,
            petListingId: listing.id,
            status: EnquiryStatus.NEW,
          },
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
      // exist a moment ago — the seller's identity room is what reaches
      // their inbox instead. An existing thread's message still also goes
      // to `emitEnquiryMessage` below, exactly as any other reply does.
      emitEnquiryCreated(
        { storeId: enquiry.storeId, individualOwnerId: enquiry.individualOwnerId },
        { enquiryId: enquiry.id }
      );
    }

    emitEnquiryMessage(
      enquiry.id,
      { storeId: enquiry.storeId, customerId: enquiry.customerId, individualOwnerId: enquiry.individualOwnerId },
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
      { storeId: enquiry.storeId, customerId: enquiry.customerId, individualOwnerId: enquiry.individualOwnerId },
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

  /**
   * "My conversations" — both the threads this user opened as a buyer and
   * the threads other people opened about pets they listed. One list, since
   * a private seller has no separate inbox to send them to.
   */
  async listForCustomer({ userId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await enquiryRepository.findAndCountForCustomer({ userId, limit, offset });

    const roleByEnquiry = Object.fromEntries(rows.map((row) => [row.id, viewerRoleOf(row, userId)]));
    // Unread means "the other side wrote it and I haven't opened it", so the
    // rows this user is selling on are counted against the opposite sender
    // to the ones they are buying on — two grouped queries, not one per row.
    const idsByRole = {
      [EnquiryViewerRole.BUYER]: rows.filter((row) => roleByEnquiry[row.id] === EnquiryViewerRole.BUYER).map((row) => row.id),
      [EnquiryViewerRole.SELLER]: rows.filter((row) => roleByEnquiry[row.id] === EnquiryViewerRole.SELLER).map((row) => row.id),
    };
    const [unreadAsBuyer, unreadAsSeller] = await Promise.all([
      enquiryRepository.countUnreadByEnquiryIds(idsByRole[EnquiryViewerRole.BUYER], MessageSenderType.PARTNER),
      enquiryRepository.countUnreadByEnquiryIds(idsByRole[EnquiryViewerRole.SELLER], MessageSenderType.CUSTOMER),
    ]);

    const items = await Promise.all(
      rows.map(async (row) => {
        const lastMessage = await enquiryRepository.findLatestMessage(row.id);
        const viewerRole = roleByEnquiry[row.id];
        const unreadCount =
          viewerRole === EnquiryViewerRole.SELLER ? (unreadAsSeller[row.id] ?? 0) : (unreadAsBuyer[row.id] ?? 0);
        return toCustomerInboxDto(row, { unreadCount, lastMessage, viewerRole });
      })
    );

    return { items, meta: { page, limit, total: count, totalPages: Math.max(Math.ceil(count / limit), 1) } };
  },

  async getThreadForCustomer({ id, userId }) {
    const enquiry = await enquiryRepository.findByIdForCustomer({ id, userId });
    if (!enquiry) throw new NotFoundError('Conversation not found');

    const { rows: messages } = await enquiryRepository.findMessages({ enquiryId: id, limit: 500, offset: 0 });
    return toCustomerThreadDto(enquiry, messages, viewerRoleOf(enquiry, userId));
  },

  /**
   * A reply from either end. `MessageSenderType.PARTNER` means "the selling
   * side", not "someone using petza-partner" — a private seller's replies
   * are stored as PARTNER so `lastMessageFromPartner`, the read-receipt
   * columns and the partner app's own DTOs all keep their single meaning.
   */
  async sendFromCustomer({ enquiryId, userId, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new BadRequestError('Message cannot be empty');

    const enquiry = await enquiryRepository.findByIdForCustomer({ id: enquiryId, userId });
    if (!enquiry) throw new NotFoundError('Conversation not found');
    if (enquiry.status === EnquiryStatus.CLOSED) throw new ForbiddenError('This conversation is closed');

    const viewerRole = viewerRoleOf(enquiry, userId);
    const fromSellerSide = viewerRole === EnquiryViewerRole.SELLER;

    const message = await sequelize.transaction(async (transaction) => {
      const created = await enquiryRepository.createMessage(
        {
          enquiryId,
          senderType: fromSellerSide ? MessageSenderType.PARTNER : MessageSenderType.CUSTOMER,
          senderId: userId,
          text: trimmed,
        },
        { transaction }
      );
      await enquiryRepository.update(
        enquiry,
        { lastMessageAt: created.createdAt, lastMessageFromPartner: fromSellerSide },
        { transaction }
      );
      return created;
    });

    emitEnquiryMessage(
      enquiryId,
      { storeId: enquiry.storeId, customerId: enquiry.customerId, individualOwnerId: enquiry.individualOwnerId },
      toLiveMessagePayload(enquiryId, message)
    );
    emitEnquiryUpdated(enquiryId, { id: enquiryId, lastMessageAt: message.createdAt });

    // Viewer-less: the recipient's own app decides what `fromMe` means for
    // it, from `fromPartner`, exactly as the live socket payload does.
    return toMessageDto(message);
  },

  async markReadByCustomer({ enquiryId, userId }) {
    const enquiry = await enquiryRepository.findByIdForCustomer({ id: enquiryId, userId });
    if (!enquiry) throw new NotFoundError('Conversation not found');

    // A private seller opening a thread marks the *buyer's* messages read —
    // same query, read from the other end.
    const readerIsPartner = viewerRoleOf(enquiry, userId) === EnquiryViewerRole.SELLER;
    await enquiryRepository.markMessagesRead({ enquiryId, readerIsPartner });
    emitEnquiryUpdated(enquiryId, { id: enquiryId, [readerIsPartner ? 'readByPartner' : 'readByCustomer']: true });
  },
};
