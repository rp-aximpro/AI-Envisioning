import { createAppDataSource } from '../infrastructure/database.js';

const dataSource = createAppDataSource();

try {
  await dataSource.initialize();
  await dataSource.undoLastMigration({ transaction: 'all' });
  console.log('Reverted the latest migration.');
} finally {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
