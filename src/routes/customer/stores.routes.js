import { Router } from 'express';

import { getStore, getStorePets, listStores } from '../../controllers/customer/storeCatalog.controller.js';
import { validate } from '../../middleware/validate.js';
import { publicStoresQuerySchema } from '../../validators/customer/storeCatalog.validator.js';

/**
 * The public store directory — mounted unprefixed as `/stores`, matching
 * petza-app's own `Endpoints.stores`.
 *
 * No `authenticate`, same reasoning as the pet catalogue: browsing stores
 * is open to guests, and a shared store link has to work for someone
 * without the app. Only ACTIVE, named stores are ever returned (see
 * `PubliclyVisibleStoreStatuses`) — a partner still in KYC is not
 * discoverable.
 */
export const customerStoresRouter = Router();

customerStoresRouter.get('/', validate(publicStoresQuerySchema, 'query'), listStores);
customerStoresRouter.get('/:idOrSlug', getStore);
customerStoresRouter.get('/:idOrSlug/pets', getStorePets);
