import 'dotenv/config';

import { createServer } from 'http';

import { app } from './app.js';
import { connectDB, sequelize } from './database/index.js';
import { initSocketServer } from './realtime/socketServer.js';
import { logger } from './utils/logger.js';

let server;

async function start() {
  await connectDB();

  // A plain http.Server rather than app.listen(), so Socket.IO can attach
  // to the same port instead of standing up a second listener — one process,
  // one port, REST and the enquiry chat's push channel side by side.
  server = createServer(app);
  initSocketServer(server);

  const port = process.env.PORT || 4000;
  server.listen(port, () => {
    logger.info(`Petza API listening on port ${port} [${process.env.NODE_ENV || 'development'}]`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);

  if (server) {
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    return;
  }

  await sequelize.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error(`Failed to start server: ${err.stack || err.message}`);
  process.exit(1);
});
