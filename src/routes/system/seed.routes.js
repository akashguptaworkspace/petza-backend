import { Router } from 'express';

import { seedDatabase } from '../../controllers/system/seed.controller.js';
import { seedAccess } from '../../middleware/seedAccess.js';

export const seedRouter = Router();

/**
 * POST /system/seed — spin up a brand-new VM/database and hit this once to
 * get the whole project seeded (migrations + every seeder). See
 * `seedAccess` for who's allowed to call it and `seedService` for what it
 * actually runs.
 */
seedRouter.post('/', seedAccess, seedDatabase);
