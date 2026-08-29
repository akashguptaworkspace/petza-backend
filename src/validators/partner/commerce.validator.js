import { z } from 'zod';

import {
  BookingStatus,
  OrderStatus,
  PayoutMethod,
  WalletTransactionType,
} from '../../config/constants.js';

const listQueryBase = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const listOrdersQuerySchema = z.object({
  ...listQueryBase,
  status: z.enum(Object.values(OrderStatus)).optional(),
  /** Matches on the order number — the only handle a customer ever quotes. */
  search: z.string().trim().max(24).optional(),
});

export const listBookingsQuerySchema = z.object({
  ...listQueryBase,
  status: z.enum(Object.values(BookingStatus)).optional(),
  /** The calendar view's window. The status tabs send neither. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * A reason is optional here and required by the service, because whether
 * it is required depends on the *target* status — cancelling needs one,
 * packing does not. Zod would have to know the transition table to express
 * that, and the transition table is the service's.
 */
export const orderStatusSchema = z.object({
  status: z.enum(Object.values(OrderStatus)),
  reason: z.string().trim().max(500).optional(),
});

export const bookingStatusSchema = z.object({
  status: z.enum(Object.values(BookingStatus)),
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  scheduledAt: z.coerce.date(),
});

export const listTransactionsQuerySchema = z.object({
  ...listQueryBase,
  type: z.enum(Object.values(WalletTransactionType)).optional(),
});

export const addPayoutAccountSchema = z.object({
  method: z.enum(Object.values(PayoutMethod)),
  accountHolderName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(34).optional(),
  ifscCode: z.string().trim().max(16).optional(),
  upiId: z.string().trim().max(120).optional(),
  isDefault: z.boolean().default(false),
});

export const withdrawSchema = z.object({
  /** Whole rupees, like every other money value in this API. */
  amountInInr: z.number().int().min(1).max(10_000_000),
});
