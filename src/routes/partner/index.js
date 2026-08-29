import { Router } from 'express';

import { partnerCommerceRouter } from './commerce.routes.js';
import { partnerListingsRouter } from './listings.routes.js';
import { partnerOnboardingRouter } from './onboarding.routes.js';
import { partnerStoreRouter } from './store.routes.js';

/**
 * Partner surface, mounted at /partner in routes/index.js — already
 * wrapped there in `authenticate` + `authorize(Context.PARTNER)`, so no
 * router below repeats either check.
 *
 * There is one partner shell now, not three (PRODUCT_CONTEXT.md §3), so
 * this file no longer mounts one router per pillar. What varies is
 * enforced a level down, by `requireCapability` on the individual routes
 * that need it — a services-only partner and a supplies-only partner hit
 * the same endpoints and are told apart there.
 *
 * Pets left this surface entirely: partners sell supplies and services,
 * and `pet_listings` is now the customer app's own "rehome my pet" flow.
 * The pet services still exist under services/shared for those customer
 * routes — they are simply no longer reachable from /partner.
 *
 * A partner request never carries its own storeId — every controller
 * derives it from `req.store`, which `requireCapability`/`requireStore`
 * resolved from the token.
 */
export const partnerRouter = Router();

/**
 * Signing up: what you offer, KYC, approval status. This is the one
 * partner surface a user reaches *before* they have a store — the whole
 * point of it is creating one — so its controllers read `req.user.id`
 * rather than `req.store`.
 */
partnerRouter.use('/onboarding', partnerOnboardingRouter);

/** The store itself, once it exists — profile, and the capabilities the "grow your business" flow turns on. */
partnerRouter.use('/store', partnerStoreRouter);

/** Products and services, each half gated on the capability it belongs to. */
partnerRouter.use('/listings', partnerListingsRouter);

/**
 * The demand side and the money: dashboard, orders, bookings, wallet.
 * Mounted at the root rather than under a prefix because these are four
 * peer surfaces of the app, not one domain — `/partner/orders`,
 * `/partner/wallet`, `/partner/dashboard`.
 */
partnerRouter.use('/', partnerCommerceRouter);
