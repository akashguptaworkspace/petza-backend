import {
  BookingStatus,
  BookingStatusTransitions,
  OrderStatus,
  OrderStatusTransitions,
  WalletReferenceType,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../config/constants.js';
import { sequelize } from '../../models/index.js';
import { commerceRepository } from '../../repositories/shared/commerce.repository.js';
import { walletRepository } from '../../repositories/shared/wallet.repository.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';

/**
 * Orders and bookings — PRODUCT_CONTEXT.md §7.
 *
 * The one rule worth stating plainly: **the terminal success states are
 * what pay the partner.** An order reaching DELIVERED and a booking
 * reaching COMPLETED each write one EARNING row into the ledger, inside
 * the same transaction as the status change, so a partner can never be
 * shown "delivered" without the money having been recorded (or the other
 * way round).
 *
 * Status moves are checked against `OrderStatusTransitions` /
 * `BookingStatusTransitions` rather than accepted as sent. The app already
 * renders only the legal next states — it reads them off the row — but
 * that is a convenience, and this is the check that counts.
 */

/** What the customer is told, and what the partner sees on the ledger row. */
function earningNote(kind, reference) {
  return kind === 'ORDER' ? `Order ${reference}` : `Booking ${reference}`;
}

export const partnerCommerceService = {
  /**
   * The one dashboard every partner opens (§6).
   *
   * Deliberately returns both halves regardless of capability: a
   * supplies-only partner gets zeroed service figures, and the *screen*
   * decides not to render those tiles by reading the store's flags. Doing
   * it that way means the shape never changes under the app when a partner
   * grows into a second capability mid-session.
   */
  async getDashboard(store) {
    const [orderCounts, bookingCounts, walletTotals] = await Promise.all([
      commerceRepository.countOrdersByStatus(store.id),
      commerceRepository.countBookingsByStatus(store.id),
      walletRepository.sumByTypeAndStatus(store.id),
    ]);

    const earned = walletTotals[`${WalletTransactionType.EARNING}:${WalletTransactionStatus.COMPLETED}`] ?? 0;
    const paidOut = walletTotals[`${WalletTransactionType.PAYOUT}:${WalletTransactionStatus.COMPLETED}`] ?? 0;
    const refunded = walletTotals[`${WalletTransactionType.REFUND}:${WalletTransactionStatus.COMPLETED}`] ?? 0;

    return {
      newOrders: orderCounts[OrderStatus.NEW] ?? 0,
      upcomingBookings: bookingCounts[BookingStatus.UPCOMING] ?? 0,
      ordersByStatus: orderCounts,
      bookingsByStatus: bookingCounts,
      availableBalanceInInr: earned - paidOut - refunded,
      lifetimeEarningsInInr: earned,
    };
  },

  // ------------------------------------------------------------------ orders

  async listOrders({ storeId, status, search, page = 1, limit = 20 }) {
    const { rows, count } = await commerceRepository.findAndCountOrders({
      storeId,
      status,
      search,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows.map(toOrderDto),
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
    };
  },

  async getOrder({ storeId, id }) {
    const order = await commerceRepository.findOrderById({ id, storeId });
    if (!order) throw new NotFoundError('Order not found');
    return toOrderDto(order);
  },

  /**
   * The status sheet's submit. Writes the EARNING row on DELIVERED, in the
   * same transaction, for the reason above.
   */
  async setOrderStatus({ storeId, id, status, reason }) {
    const order = await commerceRepository.findOrderById({ id, storeId });
    if (!order) throw new NotFoundError('Order not found');

    const allowed = OrderStatusTransitions[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestError(
        allowed.length
          ? `An order that is ${order.status} can only move to: ${allowed.join(', ')}`
          : `This order is ${order.status} and can't be changed`
      );
    }

    if ((status === OrderStatus.CANCELLED || status === OrderStatus.RETURNED) && !reason) {
      throw new BadRequestError('Tell the customer why — a reason is required');
    }

    await sequelize.transaction(async (transaction) => {
      await commerceRepository.update(
        order,
        {
          status,
          ...(reason ? { cancellationReason: reason } : {}),
          ...(status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
        { transaction }
      );

      if (status === OrderStatus.DELIVERED) {
        await walletRepository.createTransaction(
          {
            storeId,
            type: WalletTransactionType.EARNING,
            amountInInr: order.totalAmountInInr,
            referenceType: WalletReferenceType.ORDER,
            referenceId: order.id,
            status: WalletTransactionStatus.COMPLETED,
            note: earningNote('ORDER', order.orderNumber),
          },
          { transaction }
        );
      }

      // A return reverses the earning rather than deleting it: the ledger
      // is append-only, so the history still shows the sale happened.
      if (status === OrderStatus.RETURNED) {
        await walletRepository.createTransaction(
          {
            storeId,
            type: WalletTransactionType.REFUND,
            amountInInr: order.totalAmountInInr,
            referenceType: WalletReferenceType.ORDER,
            referenceId: order.id,
            status: WalletTransactionStatus.COMPLETED,
            note: `Return — ${order.orderNumber}`,
          },
          { transaction }
        );
      }
    });

    return this.getOrder({ storeId, id });
  },

  // ---------------------------------------------------------------- bookings

  async listBookings({ storeId, status, from, to, page = 1, limit = 20 }) {
    const { rows, count } = await commerceRepository.findAndCountBookings({
      storeId,
      status,
      from,
      to,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows.map(toBookingDto),
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
    };
  },

  async getBooking({ storeId, id }) {
    const booking = await commerceRepository.findBookingById({ id, storeId });
    if (!booking) throw new NotFoundError('Booking not found');
    return toBookingDto(booking);
  },

  async setBookingStatus({ storeId, id, status, reason }) {
    const booking = await commerceRepository.findBookingById({ id, storeId });
    if (!booking) throw new NotFoundError('Booking not found');

    const allowed = BookingStatusTransitions[booking.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestError(
        allowed.length
          ? `A booking that is ${booking.status} can only move to: ${allowed.join(', ')}`
          : `This booking is ${booking.status} and can't be changed`
      );
    }

    if (status === BookingStatus.CANCELLED && !reason) {
      throw new BadRequestError('Tell the customer why — a reason is required');
    }

    await sequelize.transaction(async (transaction) => {
      await commerceRepository.update(
        booking,
        {
          status,
          ...(reason ? { cancellationReason: reason } : {}),
          ...(status === BookingStatus.COMPLETED ? { completedAt: new Date() } : {}),
        },
        { transaction }
      );

      if (status === BookingStatus.COMPLETED) {
        await walletRepository.createTransaction(
          {
            storeId,
            type: WalletTransactionType.EARNING,
            amountInInr: booking.priceAtBookingInInr,
            referenceType: WalletReferenceType.BOOKING,
            referenceId: booking.id,
            status: WalletTransactionStatus.COMPLETED,
            note: earningNote('BOOKING', booking.bookingNumber),
          },
          { transaction }
        );
      }
    });

    return this.getBooking({ storeId, id });
  },

  /**
   * Moving an appointment. Its own operation rather than a field on the
   * status change, because rescheduling is not a lifecycle move — the
   * booking stays UPCOMING, it just happens later.
   */
  async rescheduleBooking({ storeId, id, scheduledAt }) {
    const booking = await commerceRepository.findBookingById({ id, storeId });
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status !== BookingStatus.UPCOMING) {
      throw new BadRequestError('Only an upcoming booking can be rescheduled');
    }
    if (new Date(scheduledAt) < new Date()) {
      throw new BadRequestError('Pick a time in the future');
    }

    await commerceRepository.update(booking, { scheduledAt });
    return this.getBooking({ storeId, id });
  },
};

// ------------------------------------------------------------------- mapping

function toOrderDto(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customer?.name ?? 'Customer',
    customerPhone: order.customer?.phone ?? null,
    totalAmountInInr: order.totalAmountInInr,
    shippingAddress: order.shippingAddress,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productListingId: item.productListingId,
      productName: item.productName,
      productImageUrl: item.productImageUrl,
      quantity: item.quantity,
      priceAtPurchaseInInr: item.priceAtPurchaseInInr,
    })),
    cancellationReason: order.cancellationReason,
    placedAt: order.placedAt,
    deliveredAt: order.deliveredAt,
    // Sent rather than re-derived in the app, so the lifecycle is written
    // down in exactly one place.
    allowedNextStatuses: order.allowedNextStatuses,
  };
}

function toBookingDto(booking) {
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    customerName: booking.customer?.name ?? 'Customer',
    customerPhone: booking.customer?.phone ?? null,
    serviceListingId: booking.serviceListingId,
    serviceName: booking.serviceName,
    scheduledAt: booking.scheduledAt,
    durationMinutes: booking.durationMinutes,
    priceAtBookingInInr: booking.priceAtBookingInInr,
    locationType: booking.locationType,
    visitAddress: booking.visitAddress,
    customerNote: booking.customerNote,
    cancellationReason: booking.cancellationReason,
    completedAt: booking.completedAt,
    allowedNextStatuses: booking.allowedNextStatuses,
  };
}
