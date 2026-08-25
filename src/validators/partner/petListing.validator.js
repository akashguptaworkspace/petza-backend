import { z } from 'zod';

import { PetListingStatus, PetListingType, PetMediaType, PetType } from '../../config/constants.js';

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

/** Shared so the customer schema can relax `priceInInr` without restating the rest. */
export const petListingMediaSchema = z
  .array(
    z.object({
      /** A path this server handed back from the upload endpoint. */
      url: z.string().min(1).startsWith('/uploads/', 'Media must be uploaded first'),
      type: z.enum(Object.values(PetMediaType)),
      isMain: z.boolean().optional().default(false),
    })
  )
  .min(1, 'A listing needs at least a main photo')
  .max(12);

export const petListingAnswerValue = answerValue;

/** The two answers no listing can be written without, whoever is publishing. */
export const petListingCoreAnswers = {
  name: z.string().trim().min(1, 'A pet name is required').max(120),
  petType: z.enum(Object.values(PetType)),
};

export const createPetListingSchema = z.object({
  answers: z
    .object({
      ...petListingCoreAnswers,
      // Required on the partner surface because every partner listing is a
      // SALE (the controller pins it). The customer surface relaxes this —
      // a rehoming listing has no price — and the service enforces the
      // per-listing-type rule for both.
      priceInInr: z.union([z.string().regex(/^\d+$/, 'Price must be a number'), z.number().int().nonnegative()]),
    })
    .catchall(answerValue),

  media: petListingMediaSchema,
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
  /** SALE / ADOPTION. Omitted means both — "All" on the Adopt / Rehome filter row. */
  listingType: z.enum(Object.values(PetListingType)).optional(),
  /**
   * Restricts the feed to pets listed by individuals rather than partner
   * stores — what the Adopt / Rehome section is. Sent as a string by the
   * client, so coerced rather than `z.boolean()`, which would reject "true".
   */
  individualOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  /**
   * Narrows the catalogue to one city. Matched against the listing's own
   * city for a private seller and the store's for a partner — see the
   * repository. Omitted means nationwide.
   */
  city: z.string().trim().min(1).optional(),
  /** The wider net, and what the catalogue opens on — a state covers every city inside it. */
  state: z.string().trim().min(1).optional(),
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
