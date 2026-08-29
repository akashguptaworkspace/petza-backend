import { Op } from 'sequelize';

import db from '../../models/index.js';

const { Booking, Order, OrderItem, ServiceListing, User } = db;

/** The buyer's name is on every order and booking card, so it always comes along. */
const CUSTOMER_INCLUDE = { model: User, as: 'customer', attributes: ['id', 'name', 'phone'] };

const ORDER_ITEMS_INCLUDE = { model: OrderItem, as: 'items', separate: true };

/** Only place `orders`, `order_items` and `bookings` are queried. */
export const commerceRepository = {
  // ------------------------------------------------------------------ orders

  findAndCountOrders({ storeId, status, search, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    if (search) where.orderNumber = { [Op.like]: `%${search}%` };

    return Order.findAndCountAll({
      where,
      include: [CUSTOMER_INCLUDE, ORDER_ITEMS_INCLUDE],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
  },

  /** `storeId` is part of the lookup, not checked after, so a guessed id 404s rather than confirming it exists. */
  findOrderById({ id, storeId }) {
    return Order.findOne({ where: { id, storeId }, include: [CUSTOMER_INCLUDE, ORDER_ITEMS_INCLUDE] });
  },

  countOrdersByStatus(storeId) {
    return countByStatus(Order, storeId);
  },

  // ---------------------------------------------------------------- bookings

  findAndCountBookings({ storeId, status, from, to, limit, offset }) {
    const where = { storeId };
    if (status) where.status = status;
    // The calendar view asks for a window; the status tabs don't.
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt[Op.gte] = from;
      if (to) where.scheduledAt[Op.lte] = to;
    }

    return Booking.findAndCountAll({
      where,
      include: [CUSTOMER_INCLUDE, { model: ServiceListing, as: 'serviceListing', attributes: ['id', 'name'] }],
      // Ordered by when they happen, not when they were made — which is
      // what both the status tabs and the calendar actually want.
      order: [['scheduledAt', 'ASC']],
      limit,
      offset,
      distinct: true,
    });
  },

  findBookingById({ id, storeId }) {
    return Booking.findOne({
      where: { id, storeId },
      include: [CUSTOMER_INCLUDE, { model: ServiceListing, as: 'serviceListing', attributes: ['id', 'name'] }],
    });
  },

  countBookingsByStatus(storeId) {
    return countByStatus(Booking, storeId);
  },

  update(row, payload, options) {
    return row.update(payload, options);
  },
};

/**
 * Counts per status in one grouped query rather than one per tab. Shared
 * because orders and bookings ask the identical question of two tables.
 */
async function countByStatus(Model, storeId) {
  const rows = await Model.findAll({
    where: { storeId },
    attributes: ['status', [Model.sequelize.fn('COUNT', '*'), 'count']],
    group: ['status'],
    raw: true,
  });
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}
