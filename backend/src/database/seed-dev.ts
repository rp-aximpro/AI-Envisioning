import argon2 from 'argon2';

import { AdminUser } from './entities/admin-user.entity.js';
import { AllowedDomain } from './entities/allowed-domain.entity.js';
import { createAppDataSource } from '../infrastructure/database.js';
import { getEnv } from '../infrastructure/env.js';

const env = getEnv();

if (env.NODE_ENV !== 'development') {
  throw new Error('Development seed is available only when NODE_ENV=development.');
}

const dataSource = createAppDataSource();

try {
  await dataSource.initialize();

  const domainRepository = dataSource.getRepository(AllowedDomain);
  const adminRepository = dataSource.getRepository(AdminUser);

  await domainRepository.upsert(
    {
      domain: 'example.local',
      displayName: 'Local development',
      active: true,
    },
    ['domain'],
  );

  const normalizedEmail = env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_BOOTSTRAP_PASSWORD, {
    type: argon2.argon2id,
  });

  await adminRepository.upsert(
    {
      email: normalizedEmail,
      passwordHash,
      displayName: 'Local Admin',
      active: true,
      lastLoginAt: null,
    },
    ['email'],
  );

  console.log(`Seeded development domain and admin user ${normalizedEmail}.`);
} finally {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
