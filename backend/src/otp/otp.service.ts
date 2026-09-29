import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { IsNull, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { OtpChallenge, type OtpPurpose } from '../database/entities/otp-challenge.entity.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../email/email-provider.js';
import { getEnv } from '../infrastructure/env.js';

export interface IssueOtpInput {
  email: string;
  purpose: OtpPurpose;
  requestIp?: string;
  workshopId?: string;
}

export interface VerifyOtpInput {
  code: string;
  email: string;
  purpose: OtpPurpose;
  workshopId?: string;
}

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpChallenge) private readonly otpRepository: Repository<OtpChallenge>,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async issue(input: IssueOtpInput): Promise<void> {
    const env = getEnv();
    const email = this.normalizeEmail(input.email);
    const now = new Date();
    const activeChallenge = await this.findActive(email, input.purpose, input.workshopId);
    const recentIpChallenge = input.requestIp ? await this.findRecentByIp(input.requestIp, input.purpose, input.workshopId) : null;

    if (
      (activeChallenge && now.getTime() - activeChallenge.createdAt.getTime() < env.OTP_RESEND_COOLDOWN_SECONDS * 1000) ||
      (recentIpChallenge && now.getTime() - recentIpChallenge.createdAt.getTime() < env.OTP_RESEND_COOLDOWN_SECONDS * 1000)
    ) {
      throw AppError.tooManyRequests('Please wait before requesting another verification code.');
    }

    if (activeChallenge) {
      activeChallenge.consumedAt = now;
      await this.otpRepository.save(activeChallenge);
    }

    const code = this.generateCode();
    const challenge = this.otpRepository.create({
      codeHash: this.hashCode(code),
      email,
      expiresAt: new Date(now.getTime() + env.OTP_TTL_MINUTES * 60_000),
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      purpose: input.purpose,
      requestIp: input.requestIp ?? null,
      workshopId: input.workshopId ?? null,
    });

    await this.otpRepository.save(challenge);
    try {
      await this.emailProvider.sendOtp({ code, purpose: input.purpose, recipient: email });
    } catch (error) {
      challenge.consumedAt = new Date();
      await this.otpRepository.save(challenge);
      throw error;
    }
  }

  async verify(input: VerifyOtpInput): Promise<void> {
    const challenge = await this.findActive(this.normalizeEmail(input.email), input.purpose, input.workshopId);
    const now = new Date();

    if (!challenge || challenge.expiresAt <= now || challenge.attemptCount >= challenge.maxAttempts) {
      if (challenge && challenge.consumedAt === null) {
        challenge.consumedAt = now;
        await this.otpRepository.save(challenge);
      }
      throw AppError.badRequest('The verification code is invalid or expired.');
    }

    if (!this.codesMatch(challenge.codeHash, input.code)) {
      challenge.attemptCount += 1;
      if (challenge.attemptCount >= challenge.maxAttempts) {
        challenge.consumedAt = now;
      }
      await this.otpRepository.save(challenge);
      throw AppError.badRequest('The verification code is invalid or expired.');
    }

    challenge.consumedAt = now;
    await this.otpRepository.save(challenge);
  }

  private async findActive(email: string, purpose: OtpPurpose, workshopId?: string): Promise<OtpChallenge | null> {
    return this.otpRepository.findOne({
      order: { createdAt: 'DESC' },
      where: {
        consumedAt: IsNull(),
        email,
        purpose,
        workshopId: workshopId ?? IsNull(),
      },
    });
  }

  private async findRecentByIp(requestIp: string, purpose: OtpPurpose, workshopId?: string): Promise<OtpChallenge | null> {
    return this.otpRepository.findOne({
      order: { createdAt: 'DESC' },
      where: {
        purpose,
        requestIp,
        workshopId: workshopId ?? IsNull(),
      },
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(code: string): string {
    return createHmac('sha256', getEnv().OTP_SECRET).update(code).digest('hex');
  }

  private codesMatch(expectedHash: string, code: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(this.hashCode(code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
