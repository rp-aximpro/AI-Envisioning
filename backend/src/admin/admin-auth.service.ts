import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, type DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { AdminSession } from '../database/entities/admin-session.entity.js';
import { AdminUser } from '../database/entities/admin-user.entity.js';
import { getEnv } from '../infrastructure/env.js';

export interface AdminIdentity {
  adminId: string;
  displayName: string;
  email: string;
}

export interface AdminSessionContext {
  identity: AdminIdentity;
  maxAgeMs: number;
}

@Injectable()
export class AdminAuthService {
  private dummyPasswordHash: Promise<string> | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AdminUser) private readonly adminRepository: Repository<AdminUser>,
    @InjectRepository(AdminSession) private readonly sessionRepository: Repository<AdminSession>,
  ) {}

  async login(email: string, password: string): Promise<{ token: string } & AdminSessionContext> {
    const env = getEnv();
    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = `email:${normalizedEmail}`;
    await this.assertLoginAllowed([emailKey]);

    const admin = await this.adminRepository.findOne({ where: { email: normalizedEmail } });
    const hash = admin?.passwordHash ?? await this.getDummyPasswordHash();
    const passwordMatches = await this.verifyPassword(hash, password);
    if (!admin || !admin.active || !passwordMatches) {
      await this.recordFailure([emailKey]);
      throw AppError.unauthorized('Invalid email or password.');
    }

    await this.clearLoginAttempts([emailKey]);
    admin.lastLoginAt = new Date();
    await this.adminRepository.save(admin);

    const now = Date.now();
    const absoluteExpiresAt = new Date(now + env.ADMIN_SESSION_ABSOLUTE_TTL_HOURS * 60 * 60_000);
    const expiresAt = new Date(Math.min(now + env.ADMIN_SESSION_IDLE_TTL_MINUTES * 60_000, absoluteExpiresAt.getTime()));
    const token = randomBytes(32).toString('base64url');
    await this.sessionRepository.save(this.sessionRepository.create({
      absoluteExpiresAt,
      adminUserId: admin.id,
      expiresAt,
      revokedAt: null,
      tokenHash: this.hashToken(token),
    }));

    return {
      identity: { adminId: admin.id, displayName: admin.displayName, email: admin.email },
      maxAgeMs: expiresAt.getTime() - now,
      token,
    };
  }

  async getSession(token: string | undefined): Promise<AdminSessionContext | null> {
    if (!token) return null;
    const now = new Date();
    const session = await this.sessionRepository.findOne({
      where: {
        absoluteExpiresAt: MoreThan(now),
        expiresAt: MoreThan(now),
        revokedAt: IsNull(),
        tokenHash: this.hashToken(token),
      },
    });
    if (!session) return null;

    const admin = await this.adminRepository.findOne({ where: { active: true, id: session.adminUserId } });
    if (!admin) {
      session.revokedAt = now;
      await this.sessionRepository.save(session);
      return null;
    }

    const env = getEnv();
    const absoluteExpiry = session.absoluteExpiresAt.getTime();
    session.expiresAt = new Date(Math.min(Date.now() + env.ADMIN_SESSION_IDLE_TTL_MINUTES * 60_000, absoluteExpiry));
    await this.sessionRepository.save(session);
    return {
      identity: { adminId: admin.id, displayName: admin.displayName, email: admin.email },
      maxAgeMs: Math.max(0, session.expiresAt.getTime() - Date.now()),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const session = await this.sessionRepository.findOne({
      where: { revokedAt: IsNull(), tokenHash: this.hashToken(token) },
    });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
    }
  }

  private async assertLoginAllowed(keys: string[]): Promise<void> {
    const env = getEnv();
    const now = Date.now();
    const windowMs = env.ADMIN_LOGIN_WINDOW_MINUTES * 60_000;
    const hashes = keys.map((key) => this.hashRateKey(key));
    const rows = await this.dataSource.query<Array<{ attemptCount: number; windowStartedAt: Date | string }>>(
      'SELECT attempt_count AS "attemptCount", window_started_at AS "windowStartedAt" FROM admin_login_attempts WHERE key_hash = ANY($1::varchar[])',
      [hashes],
    );
    if (rows.some((entry) => {
      const windowStartedAt = entry.windowStartedAt instanceof Date
        ? entry.windowStartedAt.getTime()
        : Date.parse(entry.windowStartedAt);
      return now - windowStartedAt < windowMs && entry.attemptCount >= env.ADMIN_LOGIN_MAX_ATTEMPTS;
    })) {
      throw AppError.tooManyRequests('Too many sign-in attempts. Try again later.');
    }
  }

  private async recordFailure(keys: string[]): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO admin_login_attempts (key_hash, attempt_count, window_started_at)
      SELECT key_hash, 1, now() FROM unnest($1::varchar[]) AS keys(key_hash)
      ON CONFLICT (key_hash) DO UPDATE SET
        attempt_count = CASE
          WHEN admin_login_attempts.window_started_at <= now() - ($2::integer * interval '1 minute') THEN 1
          ELSE admin_login_attempts.attempt_count + 1
        END,
        window_started_at = CASE
          WHEN admin_login_attempts.window_started_at <= now() - ($2::integer * interval '1 minute') THEN now()
          ELSE admin_login_attempts.window_started_at
        END
    `, [keys.map((key) => this.hashRateKey(key)), getEnv().ADMIN_LOGIN_WINDOW_MINUTES]);
    await this.dataSource.query("DELETE FROM admin_login_attempts WHERE window_started_at < now() - interval '1 day'");
  }

  private async clearLoginAttempts(keys: string[]): Promise<void> {
    await this.dataSource.query('DELETE FROM admin_login_attempts WHERE key_hash = ANY($1::varchar[])', [
      keys.map((key) => this.hashRateKey(key)),
    ]);
  }

  private hashRateKey(value: string): string {
    return createHmac('sha256', getEnv().SESSION_SECRET).update(value).digest('hex');
  }

  private async getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
    return this.dummyPasswordHash;
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private hashToken(token: string): string {
    return createHmac('sha256', getEnv().SESSION_SECRET).update(token).digest('hex');
  }
}
