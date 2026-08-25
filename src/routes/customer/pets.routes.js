import { Router } from 'express';

import { getPet, listPets } from '../../controllers/customer/petCatalog.controller.js';
import { optionalAuthenticate } from '../../middleware/authenticate.js';
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

/**
 * `optionalAuthenticate`, not `authenticate`: the catalogue stays open to
 * guests, but when a token IS present the feed drops that viewer's own
 * listings — see listPets.
 */
customerPetsRouter.get('/', optionalAuthenticate, validate(publicPetListingsQuerySchema, 'query'), listPets);
// `optionalAuthenticate` here too, so the service can tell an owner
// looking at their own listing from anyone else and skip counting the view.
customerPetsRouter.get('/:idOrSlug', optionalAuthenticate, getPet);
