import { Router } from 'express';

import { getWishlist, togglePet, toggleStore } from '../../controllers/customer/wishlist.controller.js';

/**
 * The customer's saved pets and stores. Never open to a guest —
 * `authenticate` is applied at the mount point in
 * `routes/customer/index.js`, same as `/enquiries`.
 *
 * `/stores/:storeId` is declared before `/:petId` so a store toggle is
 * never swallowed by the pet route's parameter.
 */
export const customerWishlistRouter = Router();

/** Both tabs' contents in one call — the app fetches this once per session. */
customerWishlistRouter.get('/', getWishlist);

customerWishlistRouter.post('/stores/:storeId', toggleStore);

/** Save/unsave in one endpoint — the server decides the direction. */
customerWishlistRouter.post('/:petId', togglePet);
