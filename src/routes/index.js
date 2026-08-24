import { Router } from 'express';

import { Context } from '../config/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { sendSuccess } from '../shared/response/sendResponse.js';
import { adminRouter } from './admin/index.js';
import { customerRouter } from './customer/index.js';
import { partnerRouter } from './partner/index.js';
import { authRouter } from './shared/auth.routes.js';
import { seedRouter } from './system/seed.routes.js';

export const API_PREFIX = '/api/v1';
export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendSuccess(res, { message: 'Petza API is healthy', data: { uptime: process.uptime() } });
});

/** Shared login/me/refresh/logout — context isn't known until the token is issued. */
apiRouter.use('/auth', authRouter);

/**
 * Public + customer-context surface — no /customer prefix, this IS the
 * public API (e.g. /pets, /stores), matching petza-app/src/api/endpoints.ts.
 */
apiRouter.use(customerRouter);

/**
 * Partner dashboard. RBAC is enforced ONCE here at the mount point — every
 * route added under routes/partner/* is automatically PARTNER-context-only,
 * it never needs to repeat `authenticate`/`authorize` itself.
 */
apiRouter.use('/partner', authenticate, authorize(Context.PARTNER), partnerRouter);

/**
 * Admin console. Same pattern as /partner above — RBAC lives at the mount
 * point, not scattered across every admin route file.
 */
apiRouter.use('/admin', authenticate, authorize(Context.ADMIN), adminRouter);

/**
 * Bootstraps a brand-new database in one call (migrate + seed everything
 * under src/database/seeders/). Deliberately NOT behind the global
 * `authenticate`/`authorize(Context.ADMIN)` pair used above — on a fresh
 * VM no user exists yet to authenticate as, admin or otherwise. Its own
 * `seedAccess` gate (inside seedRouter) enforces a shared secret key OR an
 * admin token, whichever is available at the time.
 */
apiRouter.use('/system/seed', seedRouter);
