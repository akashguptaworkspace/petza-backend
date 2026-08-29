import { z } from 'zod';

import { BusinessType, PartnerCapability } from '../../config/constants.js';

/**
 * Query contract for the public store directory. Mirrors
 * `publicPetListingsQuerySchema`'s shape (same coercion, same `limit` cap)
 * so both public catalogues page identically from the app's point of view.
 */
export const publicStoresQuerySchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  businessType: z.enum(Object.values(BusinessType)).optional(),
  /** What the store *does*, not what it is — see the service-type filter on petza-app's Stores tab. */
  capability: z.enum(Object.values(PartnerCapability)).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
