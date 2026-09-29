import argon2 from 'argon2';

import { AdminUser } from './entities/admin-user.entity.js';
import { createAppDataSource } from '../infrastructure/database.js';
import { getEnv } from '../infrastructure/env.js';

const env = getEnv();

if (env.NODE_ENV !== 'staging') {
  throw new Error('Staging admin seed is available only when NODE_ENV=staging.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set explicitly before seeding a staging admin.');
}

if (!process.env.ADMIN_BOOTSTRAP_EMAIL || !process.env.ADMIN_BOOTSTRAP_PASSWORD) {
  throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before seeding a staging admin.');
}

if (env.ADMIN_BOOTSTRAP_PASSWORD.length < 12 || env.ADMIN_BOOTSTRAP_PASSWORD === 'change-me') {
  throw new Error('ADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters.');
}

const dataSource = createAppDataSource();

try {
  await dataSource.initialize();

  const email = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_BOOTSTRAP_PASSWORD, { type: argon2.argon2id });
  await dataSource.getRepository(AdminUser).upsert({
    active: true,
    displayName: env.ADMIN_BOOTSTRAP_NAME,
    email,
    lastLoginAt: null,
    passwordHash,
  }, ['email']);

  console.log(`Seeded staging administrator ${email}.`);
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
