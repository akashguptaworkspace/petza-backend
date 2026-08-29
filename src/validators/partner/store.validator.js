import { z } from 'zod';

import { PartnerCapability } from '../../config/constants.js';

/**
 * Which capabilities to turn **on**. Additive only — there is no "off"
 * to express, because turning one off would orphan live bookings and
 * in-flight orders (PRODUCT_CONTEXT.md §3), so the service has no path
 * that does it and this schema has no shape for it.
 *
 * Sending one already on is a no-op rather than an error: the "grow your
 * business" flow submits what the partner ticked, not a diff.
 */
export const enableCapabilitiesSchema = z.object({
  capabilities: z.array(z.enum(Object.values(PartnerCapability))).min(1).max(2),
});
