import { createAppDataSource } from '../infrastructure/database.js';

const dataSource = createAppDataSource();

try {
  await dataSource.initialize();
  const migrations = await dataSource.runMigrations({ transaction: 'all' });
  console.log(`Ran ${migrations.length} migration(s).`);
} finally {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
