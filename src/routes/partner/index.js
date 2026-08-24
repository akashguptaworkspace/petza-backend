import { Router } from 'express';

import { partnerOnboardingRouter } from './onboarding.routes.js';
import { partnerPetsRouter } from './pets.routes.js';
import { partnerStoreRouter } from './store.routes.js';
import { partnerSuppliesRouter } from './supplies.routes.js';

/**
 * Partner dashboard surface, mounted at /partner in routes/index.js —
 * already wrapped there in `authenticate` + `authorize(Context.PARTNER)`,
 * so no domain router below needs to repeat either check. Add a finer
 * `authorize(Role.PARTNER_OWNER)` per-route only where an action must be
 * owner-only (payouts, staff management) — see PLATFORM_CONTEXT.md §7.2/R1.
 *
 * A partner request never carries its own storeId — every domain
 * controller derives it from `req.user.partnerStoreId`, never from the
 * body or a query param.
 *
 * Domain routers land here as each pillar is built, e.g.:
 *   partnerRouter.use('/store', storeRouter);
 *   partnerRouter.use('/pets', petsRouter);
 *   partnerRouter.use('/orders', ordersRouter);
 */
export const partnerRouter = Router();

/**
 * Signing up: business type, KYC, approval status. Note this is the one
 * partner surface a user reaches *before* they have a store — the whole
 * point of it is creating one — so its controllers read `req.user.id`
 * rather than `req.user.partnerStoreId`.
 */
partnerRouter.use('/onboarding', partnerOnboardingRouter);

/** The store itself, once it exists — currently just which pillars it runs. */
partnerRouter.use('/store', partnerStoreRouter);

/** Pillar surfaces. Each gates itself on the store capability it belongs to, so a partner only reaches the ones their business actually runs. */
partnerRouter.use('/pets', partnerPetsRouter);
partnerRouter.use('/supplies', partnerSuppliesRouter);
