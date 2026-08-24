'use strict';

/**
 * sequelize-cli config, used ONLY by the CLI (via .sequelizerc) to run
 * migrations/seeders. sequelize-cli is a legacy CommonJS tool and can't
 * `require()` an ESM module, so this file — and migrations/seeders — stay
 * `.cjs` even though the rest of the app is `"type": "module"`. The app's
 * own Sequelize connection is built independently in src/models/index.js,
 * which reads process.env directly (same as every other file) rather than
 * through a shared config module — this file duplicates that env reading
 * rather than importing it, since importing would re-introduce the
 * ESM/CJS conflict this file exists to avoid.
 */
require('dotenv').config();

const db = {
  username: process.env.DATABASE_USERNAME || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'petza_dev',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 3306,
  dialect: process.env.DATABASE_DIALECT || 'mysql',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
};

module.exports = {
  development: db,
  test: { ...db, database: `${db.database}_test` },
  production: { ...db, logging: false },
};
