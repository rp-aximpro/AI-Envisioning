import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, type Repository } from 'typeorm';

import { RequesterSession } from '../database/entities/requester-session.entity.js';
import { getEnv } from '../infrastructure/env.js';

export interface RequesterIdentity {
  domain: string;
  email: string;
}

@Injectable()
export class RequesterSessionService {
  constructor(
    @InjectRepository(RequesterSession) private readonly sessionRepository: Repository<RequesterSession>,
  ) {}

  async create(identity: RequesterIdentity): Promise<string> {
    const env = getEnv();
    const token = randomBytes(32).toString('base64url');
    await this.sessionRepository.save(this.sessionRepository.create({
      domain: identity.domain,
      email: identity.email,
      expiresAt: new Date(Date.now() + env.REQUESTER_SESSION_TTL_MINUTES * 60_000),
      revokedAt: null,
      tokenHash: this.hashToken(token),
    }));
    return token;
  }

  async getIdentity(token: string | undefined): Promise<RequesterIdentity | null> {
    if (!token) {
      return null;
    }

    const session = await this.sessionRepository.findOne({
      where: {
        expiresAt: MoreThan(new Date()),
        revokedAt: IsNull(),
        tokenHash: this.hashToken(token),
      },
    });

    return session ? { domain: session.domain, email: session.email } : null;
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const session = await this.sessionRepository.findOne({ where: { tokenHash: this.hashToken(token), revokedAt: IsNull() } });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
    }
  }

  private hashToken(token: string): string {
    return createHmac('sha256', getEnv().SESSION_SECRET).update(token).digest('hex');
  }
}
