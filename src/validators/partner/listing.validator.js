import { z } from 'zod';

import { ListingType, ProductListingStatus, ServiceListingStatus, ServiceLocationType } from '../../config/constants.js';

/**
 * Note what these schemas deliberately do *not* check: the contents of
 * `attributes`. Those fields are defined by rows in `category_attributes`,
 * so what counts as valid changes whenever admin edits the taxonomy —
 * which is the whole point (PRODUCT_CONTEXT.md §10). A static Zod shape
 * would freeze it at whatever it was the day this file was written.
 *
 * Zod's job here is the fixed columns; `listing.service.js` validates the
 * dynamic half against the database.
 */

const uuid = z.string().uuid();
const priceInInr = z.number().int().min(0).max(10_000_000);
/** A URL string; the media pipeline hands these back from its own upload endpoint. */
const imageUrl = z.string().trim().min(1).max(2048);
const attributes = z.record(z.string(), z.unknown()).default({});

export const listingTypeQuerySchema = z.object({
  type: z.enum(Object.values(ListingType)),
});

const listQueryBase = {
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const listProductsQuerySchema = z.object({
  ...listQueryBase,
  status: z.enum(Object.values(ProductListingStatus)).optional(),
  tagId: uuid.optional(),
});

export const listServicesQuerySchema = z.object({
  ...listQueryBase,
  status: z.enum(Object.values(ServiceListingStatus)).optional(),
  categoryId: uuid.optional(),
});

export const createProductSchema = z
  .object({
    /** The subcategory tag. The root it files under is derived from this, never sent. */
    tagId: uuid,
    name: z.string().trim().min(1, 'Name is required').max(160),
    description: z.string().trim().max(4000).optional(),
    priceInInr,
    mrpInInr: priceInInr.optional(),
    stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
    sku: z.string().trim().max(64).optional(),
    images: z.array(imageUrl).max(10).default([]),
    attributes,
    /** Only DRAFT or ACTIVE on create — PAUSED and OUT_OF_STOCK are states a live listing moves into, not ones it starts in. */
    status: z.enum([ProductListingStatus.DRAFT, ProductListingStatus.ACTIVE]).default(ProductListingStatus.DRAFT),
  })
  // A "was" price below the asking price reads as a discount that isn't
  // one, so it is rejected rather than quietly hidden by the UI.
  .refine((value) => value.mrpInInr === undefined || value.mrpInInr >= value.priceInInr, {
    message: 'MRP cannot be lower than the selling price',
    path: ['mrpInInr'],
  });

export const updateProductSchema = createProductSchema.innerType().partial();

export const createServiceSchema = z.object({
  categoryId: uuid,
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: z.string().trim().max(4000).optional(),
  /** Capped at a full day: anything longer is a package sold as several bookings, not one appointment. */
  durationMinutes: z.number().int().min(5).max(1440),
  priceInInr,
  locationType: z.enum(Object.values(ServiceLocationType)).default(ServiceLocationType.AT_STORE),
  images: z.array(imageUrl).max(10).default([]),
  attributes,
  availability: z.array(availabilitySlot()).max(100).optional(),
  status: z.enum([ServiceListingStatus.DRAFT, ServiceListingStatus.ACTIVE]).default(ServiceListingStatus.DRAFT),
});

export const updateServiceSchema = createServiceSchema.partial();

export const productStatusSchema = z.object({
  status: z.enum(Object.values(ProductListingStatus)),
});

export const serviceStatusSchema = z.object({
  status: z.enum(Object.values(ServiceListingStatus)),
});

export const availabilitySchema = z.object({
  availability: z.array(availabilitySlot()).max(100),
});

/**
 * One recurring weekly window. Factored into a function so the create,
 * update and standalone-availability schemas share one definition of what
 * a slot is — three copies would drift.
 */
function availabilitySlot() {
  return z
    .object({
      /** 0 = Sunday, matching `Date#getDay`. */
      dayOfWeek: z.number().int().min(0).max(6),
      /** `HH:MM` or `HH:MM:SS`, in the store's local time. */
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM'),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM'),
      maxBookingsPerSlot: z.number().int().min(1).max(50).default(1),
    })
    .refine((slot) => slot.startTime < slot.endTime, {
      // String comparison is sound for zero-padded 24-hour times, and an
      // overnight window would need its own end-day field to be meaningful.
      message: 'End time must be after start time',
      path: ['endTime'],
    });
}
