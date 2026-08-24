import { Router } from 'express';

import { updateCapabilities } from '../../controllers/partner/store.controller.js';
import { validate } from '../../middleware/validate.js';
import { updateCapabilitiesSchema } from '../../validators/partner/store.validator.js';

/**
 * The partner's own store. Only the capability set lives here so far —
 * the pillars this business runs, which is what decides the dashboards
 * the app opens for them. Profile, hours and staff land here next.
 */
export const partnerStoreRouter = Router();

partnerStoreRouter.patch('/capabilities', validate(updateCapabilitiesSchema), updateCapabilities);
