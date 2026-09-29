import pino from 'pino';
import { writeFileSync } from 'node:fs';

import { createAppDataSource } from './infrastructure/database.js';
import { ensureStorageBucket } from './infrastructure/object-storage.js';

const logger = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

async function bootstrapWorker() {
  const dataSource = createAppDataSource();

  await dataSource.initialize();
  logger.info('Worker connected to PostgreSQL');

  await ensureStorageBucket(logger);
  logger.info('Worker bootstrap ready');
  writeFileSync('/tmp/ai-envision-worker-ready', new Date().toISOString());

  const keepAlive = setInterval(() => {
    logger.debug('Worker heartbeat');
    writeFileSync('/tmp/ai-envision-worker-ready', new Date().toISOString());
  }, 60_000);

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Worker shutting down');
    clearInterval(keepAlive);
    await dataSource.destroy();
    process.exit(0);
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrapWorker().catch((error: unknown) => {
  logger.error({ err: error }, 'Worker failed to start');
  process.exit(1);
});
