import 'dotenv/config';

import { readdirSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { DataTypes, Sequelize } from 'sequelize';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

const nodeEnv = process.env.NODE_ENV || 'development';
const baseDbName = process.env.DATABASE_NAME || 'petza_dev';
const dbName = nodeEnv === 'test' ? `${baseDbName}_test` : baseDbName;

export const sequelize = new Sequelize(dbName, process.env.DATABASE_USERNAME || 'root', process.env.DATABASE_PASSWORD || '', {
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 3306,
  dialect: process.env.DATABASE_DIALECT || 'mysql',
  logging: false,
  define: { underscored: true, timestamps: true },
});

const db = {};

const modelFiles = readdirSync(currentDir).filter((file) => file !== basename(currentFile) && file.endsWith('.js'));

for (const file of modelFiles) {
  const modelModule = await import(pathToFileURL(join(currentDir, file)).href);
  const model = modelModule.default(sequelize, DataTypes);
  db[model.name] = model;
}

Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
