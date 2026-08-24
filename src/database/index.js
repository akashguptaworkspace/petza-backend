import { sequelize } from '../models/index.js';
import { logger } from '../utils/logger.js';

export { sequelize };

export async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info(`Connected to ${process.env.NODE_ENV || 'development'} database: ${sequelize.getDatabaseName()}`);
  } catch (error) {
    logger.error(`DB connection failed: ${error.message}`);
    process.exit(1);
  }
}
