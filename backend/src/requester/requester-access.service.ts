import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { AllowedDomain } from '../database/entities/allowed-domain.entity.js';
import { OtpPurpose } from '../database/entities/otp-challenge.entity.js';
import { OtpService } from '../otp/otp.service.js';
import { RequesterSessionService, type RequesterIdentity } from './requester-session.service.js';

@Injectable()
export class RequesterAccessService {
  constructor(
    @InjectRepository(AllowedDomain) private readonly allowedDomainRepository: Repository<AllowedDomain>,
    @Inject(OtpService) private readonly otpService: OtpService,
    @Inject(RequesterSessionService) private readonly requesterSessionService: RequesterSessionService,
  ) {}

  async sendOtp(email: string, requestIp?: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const domain = this.domainFromEmail(normalizedEmail);
    const allowedDomain = await this.allowedDomainRepository.findOne({ where: { active: true, domain } });

    if (!allowedDomain) {
      return;
    }

    await this.otpService.issue({
      email: normalizedEmail,
      purpose: OtpPurpose.CreateWorkshop,
      requestIp,
    });
  }

  async verifyOtp(email: string, code: string): Promise<string> {
    const normalizedEmail = this.normalizeEmail(email);
    const domain = this.domainFromEmail(normalizedEmail);
    const allowedDomain = await this.allowedDomainRepository.findOne({ where: { active: true, domain } });

    if (!allowedDomain) {
      throw AppError.badRequest('The verification code is invalid or expired.');
    }

    await this.otpService.verify({ email: normalizedEmail, code, purpose: OtpPurpose.CreateWorkshop });
    return this.requesterSessionService.create({ domain, email: normalizedEmail });
  }

  getSession(token: string | undefined): Promise<RequesterIdentity | null> {
    return this.requesterSessionService.getIdentity(token);
  }

  async logout(token: string | undefined): Promise<void> {
    await this.requesterSessionService.revoke(token);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private domainFromEmail(email: string): string {
    const separator = email.lastIndexOf('@');
    if (separator < 1 || separator === email.length - 1) {
      throw AppError.badRequest('A valid email address is required.');
    }
    return email.slice(separator + 1);
  }
}
