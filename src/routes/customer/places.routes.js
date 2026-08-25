import { Router } from 'express';

import { searchPlaces } from '../../controllers/customer/places.controller.js';
import { validate } from '../../middleware/validate.js';
import { searchPlacesQuerySchema } from '../../validators/customer/places.validator.js';

/**
 * Location-picker support — mounted unprefixed as `/places`, matching
 * petza-app's Endpoints.places. Open to guests: the location picker is
 * reachable before sign-in (HomeHeader's location chip), same reasoning as
 * /pets and /stores.
 */
export const customerPlacesRouter = Router();

// Path kept as `/cities` so an older app build keeps working; the results
// now include states too, each tagged with its `kind`.
customerPlacesRouter.get('/cities', validate(searchPlacesQuerySchema, 'query'), searchPlaces);
