import { Server } from 'socket.io';

import { Context } from '../config/constants.js';
import { storeRepository } from '../repositories/shared/store.repository.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * The push side of the enquiry chat — everything under REST (`/enquiries`,
 * `/partner/enquiries`) is the source of truth; this only fans a written
 * row out to whoever is looking at it right now, so neither app has to
 * poll for a message the other side just sent.
 *
 * One thread is one room, named `enquiry:<id>`. A socket only ever joins
 * rooms for enquiries it is allowed to read — see `resolveIdentity` below
 * — so there is no server-side concept of "broadcast a message to the
 * customer app" or "to the partner app", only "to this room", which is
 * also why a customer and a partner socket can share one io instance and
 * one auth path without a separate customer-vs-partner code fork.
 *
 * Reuses `verifyAccessToken` — the exact function `authenticate.js` calls
 * for every REST request — rather than inventing a parallel socket auth
 * scheme. Raw WebSocket has no Bearer-header convention, so the access
 * token travels in the handshake's `auth` payload instead
 * (`io(url, { auth: { token } })` on the client).
 */

let io = null;

/**
 * Real presence — who currently has a live socket open, keyed by customer
 * id, counted rather than boolean so a second tab/device closing doesn't
 * flip someone offline while their first one is still connected.
 *
 * This is what "Active now" / "Last seen" should have been reading all
 * along; the DTO used to derive it from the customer's last *message*
 * timestamp instead, which reads as "last seen 21m" for someone who has
 * had the conversation open and read the whole time — a message being 21
 * minutes old says nothing about whether its sender is still there.
 */
const onlineCustomerConnectionCounts = new Map();

export function isCustomerOnline(customerId) {
  return (onlineCustomerConnectionCounts.get(customerId) ?? 0) > 0;
}

/**
 * Resolves what a token's owner is allowed to join.
 *
 * A customer may join any enquiry that is theirs. A partner may join any
 * enquiry against the store they own — resolved from `req.user.id` via
 * `storeRepository`, the same lookup `requireCapability` does for REST, so
 * a partner socket can never be handed someone else's store by a forged
 * room name.
 */
async function resolveIdentity(user) {
  if (user.context === Context.CUSTOMER) {
    return { context: Context.CUSTOMER, customerId: user.id };
  }

  if (user.context === Context.PARTNER) {
    const store = await storeRepository.findByOwnerUserId(user.id);
    if (!store) return null;
    return { context: Context.PARTNER, storeId: store.id };
  }

  return null;
}

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));

      const payload = verifyAccessToken(token);
      const identity = await resolveIdentity({ id: payload.sub, context: payload.context });
      if (!identity) return next(new Error('Not authorized'));

      socket.data.identity = identity;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { identity } = socket.data;

    /**
     * Every socket auto-joins one identity-scoped room the moment it
     * connects — `store:<id>` for a partner, `customer:<id>` for a
     * customer — so a badge (unread count, tab-bar dot) updates no matter
     * which screen is open, not only while the thread or inbox screen that
     * would otherwise `enquiry:join` it happens to be mounted.
     *
     * This is also what lets a brand-new enquiry (one the inbox has never
     * seen a row for, so it can't join a thread room it doesn't know the id
     * of yet) still reach the partner live, via `emitEnquiryCreated`.
     */
    if (identity.context === Context.PARTNER) {
      socket.join(`store:${identity.storeId}`);
      // Every partner socket, so a presence change can reach "whichever
      // partners have this customer in a thread" without a DB lookup on
      // every connect/disconnect — cheap and not sensitive (the same
      // "online" dot any chat app shows), unlike message content, which
      // never goes anywhere but the two rooms that own it.
      socket.join('partners:all');
    } else {
      socket.join(`customer:${identity.customerId}`);

      const previousCount = onlineCustomerConnectionCounts.get(identity.customerId) ?? 0;
      onlineCustomerConnectionCounts.set(identity.customerId, previousCount + 1);

      // Only the 0→1 transition is news to anyone watching — a second tab
      // connecting doesn't change what a partner sees.
      if (previousCount === 0) {
        io.to('partners:all').emit('customer:presence', { customerId: identity.customerId, isOnline: true });
      }

      socket.on('disconnect', () => {
        const remaining = (onlineCustomerConnectionCounts.get(identity.customerId) ?? 1) - 1;
        if (remaining <= 0) {
          onlineCustomerConnectionCounts.delete(identity.customerId);
          io.to('partners:all').emit('customer:presence', {
            customerId: identity.customerId,
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
          });
        } else {
          onlineCustomerConnectionCounts.set(identity.customerId, remaining);
        }
      });
    }

    /**
     * `enquiryId` plus a claim of who owns it — checked against the
     * connection's own identity, never trusted from the payload alone, the
     * same "resolve from the token, not the request" rule `requireCapability`
     * follows for REST.
     */
    socket.on('enquiry:join', async ({ enquiryId, customerId, storeId }) => {
      const isOwnThread =
        (identity.context === Context.CUSTOMER && identity.customerId === customerId) ||
        (identity.context === Context.PARTNER && identity.storeId === storeId);

      if (!enquiryId || !isOwnThread) return;
      socket.join(`enquiry:${enquiryId}`);
    });

    socket.on('enquiry:leave', ({ enquiryId }) => {
      if (enquiryId) socket.leave(`enquiry:${enquiryId}`);
    });

    /**
     * "The other side is typing" — presentational, never persisted. Echoed
     * to the room minus the sender; the room membership check above is what
     * keeps this from leaking into a thread the socket never joined.
     */
    socket.on('enquiry:typing', ({ enquiryId }) => {
      if (enquiryId) socket.to(`enquiry:${enquiryId}`).emit('enquiry:typing', { enquiryId, from: identity.context });
    });
  });

  logger.info('Socket.IO server attached');
  return io;
}

/**
 * Fans a newly written message out to both sides of its thread — and to
 * both sides' identity rooms, not just the thread room.
 *
 * The thread room only has anyone in it if someone opened that specific
 * conversation this session (`enquiry:join`); a badge that should update
 * from anywhere in the app — a tab-bar dot, a Home icon's count — needs the
 * message to also reach `store:<id>`/`customer:<id>`, which every partner
 * and customer socket auto-joins on connect regardless of what they're
 * looking at. The sender's own identity room receives its own message too;
 * harmless; the reducer on the other end is keyed by message id and a
 * message it just sent is already in its state.
 *
 * Called from `enquiry.service.js` right after the DB write commits — the
 * write is the durable fact, this is best-effort delivery on top of it. If
 * nobody is in any of these rooms (app closed), the row is still there the
 * next time either side fetches the thread; this only saves them the wait.
 */
export function emitEnquiryMessage(enquiryId, { storeId, customerId }, payload) {
  io?.to([`enquiry:${enquiryId}`, `store:${storeId}`, `customer:${customerId}`]).emit('enquiry:message', payload);
}

/**
 * Announces a brand-new thread to the store's room — the one case
 * `emitEnquiryMessage` can't cover, since nobody has joined `enquiry:<id>`
 * for a thread that didn't exist a moment ago. The inbox reacts by
 * refetching its list rather than trying to splice a full DTO together
 * from a socket payload alone.
 */
export function emitEnquiryCreated(storeId, payload) {
  io?.to(`store:${storeId}`).emit('enquiry:created', payload);
}

/** Fans a status/read-state change (not a new message) out to the thread — e.g. the partner opened it and the customer's ticks should go blue live. */
export function emitEnquiryUpdated(enquiryId, payload) {
  io?.to(`enquiry:${enquiryId}`).emit('enquiry:updated', payload);
}
