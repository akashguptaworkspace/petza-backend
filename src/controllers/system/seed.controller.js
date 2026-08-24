import { seedService } from '../../services/system/seed.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * The one-call bootstrap: migrates the database to the latest schema, then
 * runs every seeder in src/database/seeders/ — demo users, demo partner
 * stores, the pet form schema, and whatever gets added there next. Hitting
 * this once on a freshly spun-up VM is meant to leave it in the same state
 * a developer gets from `npm run db:migrate && npm run db:seed`.
 */
export const seedDatabase = asyncHandler(async (req, res) => {
  const result = await seedService.seedAll();
  sendSuccess(res, { message: 'Database migrated and seeded successfully', data: result });
});
