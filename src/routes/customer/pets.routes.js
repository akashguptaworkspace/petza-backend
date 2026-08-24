import { Router } from 'express';

import { getPet, listPets } from '../../controllers/customer/petCatalog.controller.js';
import { validate } from '../../middleware/validate.js';
import { publicPetListingsQuerySchema } from '../../validators/partner/petListing.validator.js';

/**
 * The public pet catalogue — mounted unprefixed as `/pets`, matching
 * petza-app's own `Endpoints.pets`.
 *
 * No `authenticate`: browsing pets is open to guests, which is how a
 * shared listing link works for someone without the app. Only listings in
 * a publicly visible status are ever returned (see
 * `PubliclyVisiblePetStatuses`) — a partner's draft, sold or archived pets
 * are theirs alone.
 */
export const customerPetsRouter = Router();

customerPetsRouter.get('/', validate(publicPetListingsQuerySchema, 'query'), listPets);
customerPetsRouter.get('/:idOrSlug', getPet);
