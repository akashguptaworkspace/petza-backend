import { z } from 'zod';

import { PetListingType } from '../../config/constants.js';
import {
  PartnerSettablePetListingStatuses,
  petListingAnswerValue,
  petListingCoreAnswers,
  petListingMediaSchema,
} from '../shared/petListing.validator.js';

/**
 * Same body as a partner publishes, plus the one question only a customer
 * is asked: sell or rehome.
 *
 * Extending the partner schema rather than restating it keeps a single
 * definition of what a listing body looks like — the answer map, the media
 * rules and the "at least a main photo" floor are identical whoever is
 * publishing, and a second copy would drift.
 *
 * `priceInInr` is NOT required here at the validator level even for SALE:
 * the partner schema already requires it inside `answers`, and the service
 * is what enforces the price rule per listing type (a rehomed pet has
 * none). Keeping that in one place means the two cannot disagree.
 */
const myListingBody = z.object({
  answers: z
    .object({
      ...petListingCoreAnswers,
      // Optional here, unlike the partner schema: an ADOPTION listing has
      // no price at all. `petListingService.columnsFromAnswers` still
      // rejects a SALE without one, so the rule is enforced once, in the
      // place that knows the listing type.
      priceInInr: z
        .union([z.string().regex(/^\d*$/, 'Price must be a number'), z.number().int().nonnegative()])
        .optional(),
    })
    .catchall(petListingAnswerValue),

  media: petListingMediaSchema,
});

/** City plus the state it sits in, and whatever else the reverse-geocode returned. */
const locationSchema = z.object({
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().min(1).max(120).optional(),
  pincode: z.string().trim().min(1).max(12).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const createMyListingSchema = myListingBody.extend({
  listingType: z.enum(Object.values(PetListingType)).optional().default(PetListingType.SALE),
  /**
   * Where the pet is. Sent alongside `answers`, not inside it, because it is
   * not one of the form's questions — the app already knows the user's
   * location and passes it as context, the same way `listingType` is passed.
   * Deliberately never asked on the form: a lister should not have to type
   * where they are when the app already knows.
   */
  location: locationSchema.optional(),
});

/**
 * An edit MAY carry a listing type — the service allows SALE → ADOPTION and
 * refuses the reverse. Optional, so a client that omits it leaves the
 * stored value alone.
 */
export const updateMyListingSchema = myListingBody.extend({
  listingType: z.enum(Object.values(PetListingType)).optional(),
  location: locationSchema.optional(),
});

/**
 * The same set a partner may set directly — AVAILABLE / UNAVAILABLE / SOLD
 * / ARCHIVED. RESERVED stays out of reach here for the same reason it does
 * there: it is set by an accepted enquiry, not by a button. "Mark as
 * rehomed" on an adoption listing maps to SOLD, which is the terminal
 * "this pet has found its home" state whichever way it went.
 */
export const updateMyListingStatusSchema = z.object({
  status: z.enum(PartnerSettablePetListingStatuses),
});

export const listMyListingsQuerySchema = z.object({
  status: z.string().optional(),
  petType: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
