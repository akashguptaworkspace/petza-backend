import { z } from 'zod';

import { PetListingStatus, PetMediaType, PetType } from '../../config/constants.js';

/**
 * The statuses a partner may set directly, from the pet detail screen's
 * status buttons and its "Remove Listing" menu action. RESERVED is
 * deliberately excluded — that one is set by an accepted enquiry, not by a
 * button.
 *
 * ARCHIVED is here as the soft-delete target ("Remove Listing"), but it is
 * one-way: `petListingService.updateStatusForStore` refuses any transition
 * *out* of ARCHIVED through this endpoint, so a partner cannot accidentally
 * — or a compromised client cannot deliberately — restore a removed listing
 * by replaying the same call with a different status.
 */
export const PartnerSettablePetListingStatuses = Object.freeze([
  PetListingStatus.AVAILABLE,
  PetListingStatus.UNAVAILABLE,
  PetListingStatus.SOLD,
  PetListingStatus.ARCHIVED,
]);

/**
 * `answers` is deliberately open.
 *
 * The form's questions live in `pet_attributes`, so a schema that
 * enumerated them here would have to be edited every time one is seeded —
 * reintroducing exactly the coupling the data-driven form removes. Only the
 * three the service cannot work without are pinned; the rest are carried
 * through and land in the listing's `attributes` blob.
 */
const answerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);

export const createPetListingSchema = z.object({
  answers: z
    .object({
      name: z.string().trim().min(1, 'A pet name is required').max(120),
      petType: z.enum(Object.values(PetType)),
      priceInInr: z.union([z.string().regex(/^\d+$/, 'Price must be a number'), z.number().int().nonnegative()]),
    })
    .catchall(answerValue),

  media: z
    .array(
      z.object({
        /** A path this server handed back from the upload endpoint. */
        url: z.string().min(1).startsWith('/uploads/', 'Media must be uploaded first'),
        type: z.enum(Object.values(PetMediaType)),
        isMain: z.boolean().optional().default(false),
      })
    )
    .min(1, 'A listing needs at least a main photo')
    .max(12),
});

/**
 * Same shape as create — the app posts the whole answer map and the whole
 * media array on every save, edit included, so the server always writes a
 * complete listing rather than reconciling a partial one.
 */
export const updatePetListingSchema = createPetListingSchema;

export const updatePetListingStatusSchema = z.object({
  status: z.enum(PartnerSettablePetListingStatuses),
});

export const listPetListingsQuerySchema = z.object({
  status: z.string().optional(),
  petType: z.enum(Object.values(PetType)).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const publicPetListingsQuerySchema = z.object({
  petType: z.enum(Object.values(PetType)).optional(),
  breed: z.string().optional(),
  gender: z.string().optional(),
  size: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
