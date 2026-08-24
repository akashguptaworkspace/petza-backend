import { Router } from 'express';

/**
 * Admin console surface, mounted at /admin in routes/index.js — already
 * wrapped there in `authenticate` + `authorize(Context.ADMIN)`, so no
 * domain router below needs to repeat either check. Add a finer
 * `authorize(Role.SUPER_ADMIN)` per-route only where an action is
 * super-admin-only (platform config, admin user management) — see
 * PLATFORM_CONTEXT.md §7.2/R1.
 *
 * Domain routers land here as each pillar is built, e.g.:
 *   adminRouter.use('/stores', storesRouter);
 *   adminRouter.use('/moderation', moderationRouter);
 *   adminRouter.use('/users', usersRouter);
 */
export const adminRouter = Router();
