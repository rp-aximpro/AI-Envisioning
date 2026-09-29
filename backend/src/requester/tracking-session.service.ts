import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, type Repository } from 'typeorm';

import { TrackingSession } from '../database/entities/tracking-session.entity.js';
import { getEnv } from '../infrastructure/env.js';

export interface TrackingIdentity {
  domain: string;
  email: string;
  workshopId: string;
}

@Injectable()
export class TrackingSessionService {
  constructor(
    @InjectRepository(TrackingSession) private readonly sessionRepository: Repository<TrackingSession>,
  ) {}

  async create(identity: TrackingIdentity): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.sessionRepository.save(this.sessionRepository.create({
      ...identity,
      expiresAt: new Date(Date.now() + getEnv().TRACKING_SESSION_TTL_MINUTES * 60_000),
      revokedAt: null,
      tokenHash: this.hashToken(token),
    }));
    return token;
  }

  async getIdentity(token: string | undefined, workshopId: string): Promise<TrackingIdentity | null> {
    if (!token) return null;
    const session = await this.sessionRepository.findOne({
      where: {
        expiresAt: MoreThan(new Date()),
        revokedAt: IsNull(),
        tokenHash: this.hashToken(token),
        workshopId,
      },
    });
    return session ? { domain: session.domain, email: session.email, workshopId: session.workshopId } : null;
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    const session = await this.sessionRepository.findOne({
      where: { tokenHash: this.hashToken(token), revokedAt: IsNull() },
    });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
    }
  }

  private hashToken(token: string): string {
    return createHmac('sha256', getEnv().SESSION_SECRET).update(token).digest('hex');
  }
}
