import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { customerEnquiriesRouter } from './enquiries.routes.js';
import { customerPetsRouter } from './pets.routes.js';
import { customerStoresRouter } from './stores.routes.js';

/**
 * Public / customer-context surface. Mounted with NO prefix in
 * routes/index.js — these endpoints read as /pets, /stores, /orders, etc.,
 * matching petza-app/src/api/endpoints.ts exactly (see
 * PLATFORM_CONTEXT.md §7.2 for why the customer surface is unprefixed
 * while partner/admin are not).
 *
 * Reads are open to guests; a domain router adds `authenticate` itself on
 * whichever of its own routes require a signed-in customer (e.g. wishlist,
 * orders) — unlike partner/admin, this group has no blanket auth gate at
 * the mount point, since most of it is public catalog browsing.
 *
 * Domain routers land here as each pillar is built, e.g.:
 *   customerRouter.use('/stores', storesRouter);
 *   customerRouter.use('/services', catalogRouter);
 *   customerRouter.use('/wishlist', authenticate, wishlistRouter);
 *   customerRouter.use('/orders', authenticate, ordersRouter);
 */
export const customerRouter = Router();

/** The pet catalogue partners publish into. Open to guests — a shared listing link has to work without the app. */
customerRouter.use('/pets', customerPetsRouter);

/** The approved-partner store directory. Open to guests for the same reason. */
customerRouter.use('/stores', customerStoresRouter);

/** "Message the seller" and the customer's own conversation list — signed-in only, gated inside the router itself. */
customerRouter.use('/enquiries', authenticate, customerEnquiriesRouter);
