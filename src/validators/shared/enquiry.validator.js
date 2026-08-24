import { z } from 'zod';

import { EnquiryStatus } from '../../config/constants.js';

const messageText = z.string().trim().min(1, 'Message cannot be empty').max(4000);

export const listEnquiriesQuerySchema = z.object({
  status: z.enum(Object.values(EnquiryStatus)).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const listCustomerEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/** The customer's "message the seller" entry point — opens (or reopens) the thread and posts the first message in one call. */
export const startEnquirySchema = z.object({
  petListingId: z.string().uuid('A valid pet listing id is required'),
  text: messageText,
});

export const sendMessageSchema = z.object({
  text: messageText,
});

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(Object.values(EnquiryStatus)),
});
