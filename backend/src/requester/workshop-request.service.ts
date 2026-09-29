import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { PinoLoggerService } from '../common/logging/pino-logger.service.js';
import { Country } from '../database/entities/country.entity.js';
import { RequesterRole, Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { EMAIL_PROVIDER, type EmailDeliveryMode, type EmailProvider } from '../email/email-provider.js';
import { getEnv } from '../infrastructure/env.js';
import { type RequesterIdentity } from './requester-session.service.js';

export interface CreateWorkshopInput {
  creatorName: string;
  customerName: string;
  description: string;
  durationMinutes: number;
  estimatedAttendees: number;
  executionSupportDetails: string | null;
  executionSupportRequired: boolean;
  fundingRequired: boolean;
  location: string;
  plannedStartAt: Date;
  requestedFundingAmount: string | null;
  requesterRole: RequesterRole;
  timezone: string;
  countryCode: string;
}

export interface CreatedWorkshop {
  confirmationEmail: string;
  emailDeliveryMode: EmailDeliveryMode | 'failed';
  id: string;
  qrCodeDataUrl: string;
  status: WorkshopStatus;
  trackingUrl: string;
  workshopCode: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

@Injectable()
export class WorkshopRequestService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(Country) private readonly countryRepository: Repository<Country>,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(PinoLoggerService) private readonly logger: PinoLoggerService,
  ) {}

  async create(input: CreateWorkshopInput, requester: RequesterIdentity): Promise<CreatedWorkshop> {
    const country = await this.countryRepository.findOne({ where: { active: true, code: input.countryCode } });
    if (!country) {
      throw AppError.badRequest('Select an available country.');
    }

    const workshop = this.workshopRepository.create({
      ...input,
      creatorDomain: requester.domain,
      creatorEmail: requester.email,
      currencyCode: getEnv().PROGRAM_CURRENCY,
      status: WorkshopStatus.PendingReview,
      trackingToken: randomBytes(32).toString('base64url'),
      workshopCode: await this.nextWorkshopCode(),
    });
    const env = getEnv();
    const trackingUrl = new URL(`/workshops/${workshop.trackingToken}`, env.APP_BASE_URL).toString();
    const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
    const savedWorkshop = await this.workshopRepository.save(workshop);
    let emailDeliveryMode: CreatedWorkshop['emailDeliveryMode'] = 'failed';

    try {
      emailDeliveryMode = await this.emailProvider.sendWorkshopConfirmation({
        html: this.confirmationHtml(savedWorkshop, trackingUrl),
        recipient: requester.email,
        subject: `Workshop request ${savedWorkshop.workshopCode} received`,
        text: this.confirmationText(savedWorkshop, trackingUrl),
      });
    } catch (error) {
      this.logger.error('Workshop confirmation email delivery failed', {
        err: error,
        workshopCode: savedWorkshop.workshopCode,
      });
    }

    return {
      confirmationEmail: requester.email,
      emailDeliveryMode,
      id: savedWorkshop.id,
      qrCodeDataUrl,
      status: savedWorkshop.status,
      trackingUrl,
      workshopCode: savedWorkshop.workshopCode,
    };
  }

  private confirmationText(workshop: Workshop, trackingUrl: string): string {
    const plannedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: workshop.timezone,
    }).format(workshop.plannedStartAt);

    return [
      `Hello ${workshop.creatorName},`,
      '',
      `Your AI Envisioning Workshop request for ${workshop.customerName} has been submitted.`,
      `Workshop ID: ${workshop.workshopCode}`,
      `Planned date: ${plannedDate}`,
      `Current status: ${workshop.status.replace('_', ' ')}`,
      '',
      `Track your workshop: ${trackingUrl}`,
      '',
      'For your security, this link alone does not grant access. Email OTP verification from the workshop creator domain is required.',
    ].join('\n');
  }

  private confirmationHtml(workshop: Workshop, trackingUrl: string): string {
    const plannedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: workshop.timezone,
    }).format(workshop.plannedStartAt);
    const safeTrackingUrl = escapeHtml(trackingUrl);

    return [
      '<!doctype html>',
      '<html lang="en"><body>',
      `<p>Hello ${escapeHtml(workshop.creatorName)},</p>`,
      `<p>Your AI Envisioning Workshop request for <strong>${escapeHtml(workshop.customerName)}</strong> has been submitted.</p>`,
      '<ul>',
      `<li><strong>Workshop ID:</strong> ${escapeHtml(workshop.workshopCode)}</li>`,
      `<li><strong>Planned date:</strong> ${escapeHtml(plannedDate)}</li>`,
      `<li><strong>Current status:</strong> ${escapeHtml(workshop.status.replace('_', ' '))}</li>`,
      '</ul>',
      `<p><a href="${safeTrackingUrl}">Track your workshop</a></p>`,
      `<p>${safeTrackingUrl}</p>`,
      '<p>For your security, this link alone does not grant access. Email OTP verification from the workshop creator domain is required.</p>',
      '</body></html>',
    ].join('');
  }

  private async nextWorkshopCode(): Promise<string> {
    const result = await this.dataSource.query<{ sequenceValue: string }[]>(
      'SELECT nextval(\'workshop_code_sequence\')::text AS "sequenceValue"',
    );
    const sequenceValue = result[0]?.sequenceValue;
    if (!sequenceValue) {
      throw new Error('Unable to allocate a workshop code.');
    }

    return `AIW-${new Date().getUTCFullYear()}-${sequenceValue.padStart(6, '0')}`;
  }
}
