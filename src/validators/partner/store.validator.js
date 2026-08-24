import { z } from 'zod';

import { StoreCapability } from '../../config/constants.js';

/**
 * The full capability set the store should end up with. The server pins
 * the business type's own capability on regardless, so leaving it out of
 * the list can't strand a vet without care.
 */
export const updateCapabilitiesSchema = z.object({
  capabilities: z.array(z.enum(Object.values(StoreCapability))).min(1).max(3),
});
