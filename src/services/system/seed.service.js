import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { ServiceUnavailableError } from '../../shared/errors/AppError.js';
import { logger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);

// Repo root of this package — .sequelizerc and node_modules/.bin both live
// here, and sequelize-cli resolves its config relative to cwd.
const currentDir = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(currentDir, '../../../');
const SEQUELIZE_CLI = join(BACKEND_ROOT, 'node_modules/.bin/sequelize');

/** Runs one sequelize-cli subcommand as a child process, the same way `npm run db:migrate`/`db:seed` do — so this route can never drift from what a developer running those scripts by hand gets. */
async function runCli(args, label) {
  try {
    const { stdout, stderr } = await execFileAsync(SEQUELIZE_CLI, args, {
      cwd: BACKEND_ROOT,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr) logger.warn(`${label} stderr: ${stderr}`);
    return stdout;
  } catch (err) {
    logger.error(`${label} failed: ${err.stderr || err.message}`);
    throw new ServiceUnavailableError(`${label} failed: ${(err.stderr || err.message || '').trim().slice(-2000)}`);
  }
}

/**
 * Takes the database from "however it currently is" — empty on a fresh
 * VM, partially migrated, or already seeded — to fully migrated and fully
 * seeded, by running the exact same two sequelize-cli commands `npm run
 * db:migrate` and `npm run db:seed` run.
 *
 * Both are idempotent by construction: sequelize-cli tracks applied
 * migrations/seeders in their own tables and skips ones already run, and
 * every seeder under src/database/seeders/ is itself written to upsert
 * rather than assume an empty table (see 20260824000002-pet-form-schema.cjs
 * for why). So calling this twice in a row is safe — the second call is a
 * fast no-op on the migration/seeder files it's already applied.
 */
export const seedService = {
  async seedAll() {
    const migrateLog = await runCli(['db:migrate'], 'db:migrate');
    const seedLog = await runCli(['db:seed:all'], 'db:seed:all');
    return { migrate: migrateLog.trim(), seed: seedLog.trim() };
  },
};
