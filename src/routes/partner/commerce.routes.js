import { Router } from 'express';

import {
  addPayoutAccount,
  getBooking,
  getDashboard,
  getOrder,
  getWalletSummary,
  listBookings,
  listOrders,
  listPayoutAccounts,
  listTransactions,
  requestWithdrawal,
  rescheduleBooking,
  setBookingStatus,
  setOrderStatus,
} from '../../controllers/partner/commerce.controller.js';
import { PartnerCapability } from '../../config/constants.js';
import { requireCapability, requireStore } from '../../middleware/requireCapability.js';
import { validate } from '../../middleware/validate.js';
import {
  addPayoutAccountSchema,
  bookingStatusSchema,
  listBookingsQuerySchema,
  listOrdersQuerySchema,
  listTransactionsQuerySchema,
  orderStatusSchema,
  rescheduleBookingSchema,
  withdrawSchema,
} from '../../validators/partner/commerce.validator.js';

/**
 * Orders, bookings and the wallet — PRODUCT_CONTEXT.md §6.
 *
 * Three routers' worth of surface in one file because they share one shape:
 * orders are gated on PRODUCTS, bookings on SERVICES, and the dashboard and
 * wallet on neither, since every partner has both regardless of what they
 * sell.
 *
 * That last point is the whole design. A partner's money and their home
 * screen are not capability-specific — a groomer and a supplies shop see
 * the same wallet — so gating those would be inventing a distinction the
 * product does not have.
 */
export const partnerCommerceRouter = Router();

/** The single dashboard every partner opens. Returns both halves; the screen renders the ones its flags call for. */
partnerCommerceRouter.get('/dashboard', requireStore, getDashboard);

const products = requireCapability(PartnerCapability.PRODUCTS);
const services = requireCapability(PartnerCapability.SERVICES);

partnerCommerceRouter.get('/orders', products, validate(listOrdersQuerySchema, 'query'), listOrders);
partnerCommerceRouter.get('/orders/:id', products, getOrder);
partnerCommerceRouter.patch('/orders/:id/status', products, validate(orderStatusSchema), setOrderStatus);

partnerCommerceRouter.get('/bookings', services, validate(listBookingsQuerySchema, 'query'), listBookings);
partnerCommerceRouter.get('/bookings/:id', services, getBooking);
partnerCommerceRouter.patch('/bookings/:id/status', services, validate(bookingStatusSchema), setBookingStatus);
// Rescheduling is not a lifecycle move — the booking stays UPCOMING, it
// just happens later — so it is its own route rather than a status body.
partnerCommerceRouter.patch(
  '/bookings/:id/reschedule',
  services,
  validate(rescheduleBookingSchema),
  rescheduleBooking
);

partnerCommerceRouter.get('/wallet', requireStore, getWalletSummary);
partnerCommerceRouter.get(
  '/wallet/transactions',
  requireStore,
  validate(listTransactionsQuerySchema, 'query'),
  listTransactions
);
partnerCommerceRouter.get('/wallet/payout-accounts', requireStore, listPayoutAccounts);
partnerCommerceRouter.post(
  '/wallet/payout-accounts',
  requireStore,
  validate(addPayoutAccountSchema),
  addPayoutAccount
);
partnerCommerceRouter.post('/wallet/withdraw', requireStore, validate(withdrawSchema), requestWithdrawal);
