import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { Country } from '../database/entities/country.entity.js';
import { OtpPurpose } from '../database/entities/otp-challenge.entity.js';
import { Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { WorkshopStatusHistory } from '../database/entities/workshop-status-history.entity.js';
import { OtpService } from '../otp/otp.service.js';
import { TrackingSessionService } from './tracking-session.service.js';
import { WorkshopExecutionService, type ExecutionProofOverride, type WorkshopExecutionDetails, type WorkshopFileDetails } from './workshop-execution.service.js';
import { WorkshopOutcomeService, type WorkshopOutcomeDetails } from './workshop-outcome.service.js';

type TimelineState = 'complete' | 'current' | 'upcoming';

export interface WorkshopTrackingDetails {
  countryCode: string;
  countryName: string;
  createdAt: string;
  completedAt: string | null;
  completionNotes: string | null;
  customerName: string;
  creatorEmail: string;
  creatorName: string;
  currencyCode: string;
  declineReason: string | null;
  description: string;
  durationMinutes: number;
  estimatedAttendees: number;
  execution: WorkshopExecutionDetails | null;
  actualFundingAmount: string | null;
  approvedFundingAmount: string | null;
  leadCount: number;
  leads: WorkshopOutcomeDetails['leads'];
  opportunityCount: number;
  opportunities: WorkshopOutcomeDetails['opportunities'];
  totalPipelineValue: string;
  surveyCompletedAt: string | null;
  proofOverride: ExecutionProofOverride | null;
  files: WorkshopFileDetails[];
  executionSupportDetails: string | null;
  executionSupportRequired: boolean;
  fundingRequired: boolean;
  location: string;
  plannedStartAt: string;
  requestedFundingAmount: string | null;
  requesterRole: string;
  status: WorkshopStatus;
  timezone: string;
  timeline: Array<{ date: string | null; label: string; state: TimelineState }>;
  workshopCode: string;
}

const lifecycle = [
  { label: 'Pending review', status: WorkshopStatus.PendingReview },
  { label: 'Planned', status: WorkshopStatus.Planned },
  { label: 'Executed', status: WorkshopStatus.Executed },
  { label: 'Follow-up', status: WorkshopStatus.FollowUp },
  { label: 'Completed', status: WorkshopStatus.Completed },
] as const;

@Injectable()
export class WorkshopTrackingService {
  constructor(
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(Country) private readonly countryRepository: Repository<Country>,
    @InjectRepository(WorkshopStatusHistory) private readonly historyRepository: Repository<WorkshopStatusHistory>,
    @Inject(OtpService) private readonly otpService: OtpService,
    @Inject(TrackingSessionService) private readonly trackingSessionService: TrackingSessionService,
    @Inject(WorkshopExecutionService) private readonly executionService: WorkshopExecutionService,
    @Inject(WorkshopOutcomeService) private readonly outcomeService: WorkshopOutcomeService,
  ) {}

  async sendOtp(trackingToken: string, email: string, requestIp?: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop || this.domainFromEmail(normalizedEmail) !== workshop.creatorDomain) return;

    await this.otpService.issue({
      email: normalizedEmail,
      purpose: OtpPurpose.TrackWorkshop,
      requestIp,
      workshopId: workshop.id,
    });
  }

  async verifyOtp(trackingToken: string, email: string, code: string): Promise<string> {
    const normalizedEmail = this.normalizeEmail(email);
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop || this.domainFromEmail(normalizedEmail) !== workshop.creatorDomain) {
      throw AppError.badRequest('The verification code is invalid or expired.');
    }

    await this.otpService.verify({
      code,
      email: normalizedEmail,
      purpose: OtpPurpose.TrackWorkshop,
      workshopId: workshop.id,
    });
    return this.trackingSessionService.create({
      domain: workshop.creatorDomain,
      email: normalizedEmail,
      workshopId: workshop.id,
    });
  }

  async getWorkshop(trackingToken: string, sessionToken: string | undefined): Promise<WorkshopTrackingDetails> {
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop) throw AppError.notFound();

    const identity = await this.trackingSessionService.getIdentity(sessionToken, workshop.id);
    if (!identity || identity.domain !== workshop.creatorDomain) throw AppError.unauthorized();

    const [country, history, executionDetails, outcome] = await Promise.all([
      this.countryRepository.findOne({ where: { code: workshop.countryCode } }),
      this.historyRepository.find({ where: { workshopId: workshop.id }, order: { createdAt: 'ASC' } }),
      this.executionService.getExecutionDetails(workshop.id),
      this.outcomeService.getOutcome(workshop.id),
    ]);
    const completedStatuses = new Set([
      WorkshopStatus.PendingReview,
      ...history.filter((entry) => entry.toStatus !== WorkshopStatus.Declined).map((entry) => entry.toStatus),
    ]);
    const statusDates = new Map(history.map((entry) => [entry.toStatus, entry.createdAt.toISOString()]));
    const currentIndex = lifecycle.findIndex((item) => item.status === workshop.status);
    const timeline = lifecycle.map((item, index) => ({
      date: item.status === WorkshopStatus.PendingReview
        ? workshop.createdAt.toISOString()
        : statusDates.get(item.status) ?? (item.status === WorkshopStatus.Planned
          ? workshop.approvedAt?.toISOString() ?? null
          : item.status === WorkshopStatus.Completed
            ? workshop.completedAt?.toISOString() ?? null
            : null),
      label: item.label,
      state: workshop.status === WorkshopStatus.Declined
        ? completedStatuses.has(item.status) ? 'complete' : 'upcoming'
        : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
    } satisfies { date: string | null; label: string; state: TimelineState }));

    if (workshop.status === WorkshopStatus.Declined) {
      timeline.push({ date: statusDates.get(WorkshopStatus.Declined) ?? workshop.declinedAt?.toISOString() ?? null, label: 'Declined', state: 'current' });
    }

    return {
      countryCode: workshop.countryCode,
      countryName: country?.name ?? workshop.countryCode,
      createdAt: workshop.createdAt.toISOString(),
      completedAt: workshop.completedAt?.toISOString() ?? null,
      completionNotes: outcome.completionNotes,
      customerName: workshop.customerName,
      creatorEmail: workshop.creatorEmail,
      creatorName: workshop.creatorName,
      currencyCode: workshop.currencyCode,
      declineReason: workshop.status === WorkshopStatus.Declined ? workshop.declineReason : null,
      description: workshop.description,
      durationMinutes: workshop.durationMinutes,
      estimatedAttendees: workshop.estimatedAttendees,
      execution: executionDetails.execution,
      actualFundingAmount: outcome.actualFundingAmount,
      approvedFundingAmount: workshop.fundingRequired ? workshop.approvedFundingAmount : null,
      leadCount: outcome.leadCount,
      leads: outcome.leads,
      opportunityCount: outcome.opportunityCount,
      opportunities: outcome.opportunities,
      totalPipelineValue: outcome.totalPipelineValue,
      surveyCompletedAt: workshop.surveyCompletedAt?.toISOString() ?? null,
      proofOverride: workshop.proofOverrideAt && workshop.proofOverrideByEmail && workshop.proofOverrideReason ? {
        email: workshop.proofOverrideByEmail,
        reason: workshop.proofOverrideReason,
        recordedAt: workshop.proofOverrideAt.toISOString(),
      } : null,
      files: executionDetails.files,
      executionSupportDetails: workshop.executionSupportDetails,
      executionSupportRequired: workshop.executionSupportRequired,
      fundingRequired: workshop.fundingRequired,
      location: workshop.location,
      plannedStartAt: workshop.plannedStartAt.toISOString(),
      requestedFundingAmount: workshop.fundingRequired ? workshop.requestedFundingAmount : null,
      requesterRole: workshop.requesterRole,
      status: workshop.status,
      timezone: workshop.timezone,
      timeline,
      workshopCode: workshop.workshopCode,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private domainFromEmail(email: string): string {
    return email.slice(email.lastIndexOf('@') + 1);
  }
}
