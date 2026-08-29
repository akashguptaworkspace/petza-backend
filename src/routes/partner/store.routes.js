import { Router } from 'express';

import { enableCapabilities } from '../../controllers/partner/store.controller.js';
import { validate } from '../../middleware/validate.js';
import { enableCapabilitiesSchema } from '../../validators/partner/store.validator.js';

/**
 * The partner's own store. Only capabilities live here so far — what
 * this business offers, which is what the single partner dashboard
 * adapts around. Profile, hours and staff land here next.
 *
 * POST rather than PATCH because the operation is additive-only: it turns
 * capabilities on and has no way to express turning one off (§3), so it
 * is not a partial replacement of the resource.
 */
export const partnerStoreRouter = Router();

partnerStoreRouter.post('/capabilities', validate(enableCapabilitiesSchema), enableCapabilities);
