import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { In, type DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { type AdminIdentity } from './admin-auth.service.js';
import { Country } from '../database/entities/country.entity.js';
import { Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { WorkshopFile } from '../database/entities/workshop-file.entity.js';
import { WorkshopStatusHistory } from '../database/entities/workshop-status-history.entity.js';
import { EMAIL_PROVIDER, type EmailDeliveryMode, type EmailProvider } from '../email/email-provider.js';
import { PinoLoggerService } from '../common/logging/pino-logger.service.js';
import { getEnv } from '../infrastructure/env.js';
import { WorkshopExecutionService, type ExecutionProofOverride, type WorkshopExecutionDetails, type WorkshopFileDetails } from '../requester/workshop-execution.service.js';

export type WorkshopSortBy = 'workshopCode' | 'customerName' | 'creatorName' | 'plannedStartAt' | 'status' | 'createdAt';

export interface AdminWorkshopListQuery {
  countryCode?: string;
  creator?: string;
  page: number;
  pageSize: number;
  requesterRole?: string;
  search?: string;
  sortBy: WorkshopSortBy;
  sortOrder: 'asc' | 'desc';
  status?: WorkshopStatus;
}

export interface AdminWorkshopDetail {
  approvedAt: string | null;
  approvedFundingAmount: string | null;
  countryCode: string;
  countryName: string;
  createdAt: string;
  creatorDomain: string;
  creatorEmail: string;
  creatorName: string;
  currencyCode: string;
  declineReason: string | null;
  declinedAt: string | null;
  description: string;
  durationMinutes: number;
  estimatedAttendees: number;
  executionSupportDetails: string | null;
  executionSupportRequired: boolean;
  execution: WorkshopExecutionDetails | null;
  proofOverride: ExecutionProofOverride | null;
  files: WorkshopFileDetails[];
  fundingRequired: boolean;
  location: string;
  plannedStartAt: string;
  completedAt: string | null;
  requestedFundingAmount: string | null;
  requesterRole: string;
  status: WorkshopStatus;
  statusHistory: Array<{
    changedByEmail: string | null;
    createdAt: string;
    fromStatus: WorkshopStatus;
    reason: string | null;
    toStatus: WorkshopStatus;
  }>;
  timezone: string;
  updatedAt: string;
  workshopCode: string;
}

export interface AdminWorkshopListItem {
  countryCode: string;
  countryName: string;
  createdAt: string;
  creatorEmail: string;
  creatorName: string;
  currencyCode: string;
  customerName: string;
  fundingRequired: boolean;
  plannedStartAt: string;
  requestedFundingAmount: string | null;
  requesterRole: string;
  status: WorkshopStatus;
  workshopCode: string;
  id: string;
}

export interface AdminWorkshopPage {
  items: AdminWorkshopListItem[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}

export interface ReviewResult {
  emailDeliveryMode: EmailDeliveryMode | 'failed';
  workshop: AdminWorkshopDetail;
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
export class AdminWorkshopsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(Country) private readonly countryRepository: Repository<Country>,
    @InjectRepository(WorkshopStatusHistory) private readonly historyRepository: Repository<WorkshopStatusHistory>,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(PinoLoggerService) private readonly logger: PinoLoggerService,
    @Inject(WorkshopExecutionService) private readonly executionService: WorkshopExecutionService,
  ) {}

  async list(query: AdminWorkshopListQuery): Promise<AdminWorkshopPage> {
    const builder = this.workshopRepository.createQueryBuilder('workshop');
    if (query.status) builder.andWhere('workshop.status = :status', { status: query.status });
    if (query.countryCode) builder.andWhere('workshop.countryCode = :countryCode', { countryCode: query.countryCode });
    if (query.requesterRole) builder.andWhere('workshop.requesterRole = :requesterRole', { requesterRole: query.requesterRole });
    if (query.search) {
      builder.andWhere(
        '(workshop.workshopCode ILIKE :search OR workshop.customerName ILIKE :search OR workshop.creatorName ILIKE :search OR workshop.creatorEmail ILIKE :search OR workshop.location ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.creator) {
      builder.andWhere('(workshop.creatorName ILIKE :creator OR workshop.creatorEmail ILIKE :creator)', {
        creator: `%${query.creator}%`,
      });
    }

    const sortColumns: Record<WorkshopSortBy, string> = {
      createdAt: 'workshop.createdAt',
      creatorName: 'workshop.creatorName',
      customerName: 'workshop.customerName',
      plannedStartAt: 'workshop.plannedStartAt',
      status: 'workshop.status',
      workshopCode: 'workshop.workshopCode',
    };
    builder.orderBy(sortColumns[query.sortBy], query.sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .addOrderBy('workshop.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [workshops, total] = await builder.getManyAndCount();
    const countries = workshops.length
      ? await this.countryRepository.find({ where: { code: In([...new Set(workshops.map((workshop) => workshop.countryCode))]) } })
      : [];
    const countryNames = new Map(countries.map((country) => [country.code, country.name]));
    const items = workshops.map((workshop) => ({
      countryCode: workshop.countryCode,
      countryName: countryNames.get(workshop.countryCode) ?? workshop.countryCode,
      createdAt: workshop.createdAt.toISOString(),
      creatorEmail: workshop.creatorEmail,
      creatorName: workshop.creatorName,
      currencyCode: workshop.currencyCode,
      customerName: workshop.customerName,
      fundingRequired: workshop.fundingRequired,
      id: workshop.id,
      plannedStartAt: workshop.plannedStartAt.toISOString(),
      requestedFundingAmount: workshop.requestedFundingAmount,
      requesterRole: workshop.requesterRole,
      status: workshop.status,
      workshopCode: workshop.workshopCode,
    }));
    return {
      items,
      page: query.page,
      pageCount: Math.ceil(total / query.pageSize),
      pageSize: query.pageSize,
      total,
    };
  }

  async getDetail(id: string): Promise<AdminWorkshopDetail> {
    const workshop = await this.workshopRepository.findOne({ where: { id } });
    if (!workshop) throw AppError.notFound('Workshop not found.');
    const [country, statusHistory, executionDetails] = await Promise.all([
      this.countryRepository.findOne({ where: { code: workshop.countryCode } }),
      this.historyRepository.find({ where: { workshopId: id }, order: { createdAt: 'ASC' } }),
      this.executionService.getExecutionDetails(id),
    ]);
    return { ...this.toDetail(workshop, country?.name ?? workshop.countryCode, statusHistory), ...executionDetails };
  }

  approve(id: string, approvedFundingAmount: number | undefined, admin: AdminIdentity): Promise<ReviewResult> {
    return this.review(id, WorkshopStatus.Planned, null, approvedFundingAmount, admin);
  }

  decline(id: string, reason: string, admin: AdminIdentity): Promise<ReviewResult> {
    return this.review(id, WorkshopStatus.Declined, reason.trim(), undefined, admin);
  }

  async overrideExecutionProof(id: string, reason: string, admin: AdminIdentity): Promise<AdminWorkshopDetail> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const workshop = await runner.manager.findOne(Workshop, { lock: { mode: 'pessimistic_write' }, where: { id } });
      if (!workshop) throw AppError.notFound('Workshop not found.');
      if (workshop.status !== WorkshopStatus.Executed) throw AppError.badRequest('A proof override can only be recorded during execution.');
      const proofFile = await runner.manager.findOne(WorkshopFile, { where: { workshopId: id } });
      if (proofFile) throw AppError.badRequest('A proof waiver is not needed after a proof file has been uploaded.');
      if (workshop.proofOverrideAt) throw AppError.badRequest('A proof override has already been recorded.');
      workshop.proofOverrideByAdminId = admin.adminId;
      workshop.proofOverrideByEmail = admin.email;
      workshop.proofOverrideReason = reason.trim();
      workshop.proofOverrideAt = new Date();
      await runner.manager.save(workshop);
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return this.getDetail(id);
  }

  private async review(
    id: string,
    toStatus: WorkshopStatus.Planned | WorkshopStatus.Declined,
    reason: string | null,
    approvedFundingAmount: number | undefined,
    admin: AdminIdentity,
  ): Promise<ReviewResult> {
    const runner = this.dataSource.createQueryRunner();
    let updated: Workshop;
    await runner.connect();
    try {
      await runner.startTransaction();
      const workshop = await runner.manager.findOne(Workshop, {
        lock: { mode: 'pessimistic_write' },
        where: { id },
      });
      if (!workshop) throw AppError.notFound('Workshop not found.');
      if (workshop.status !== WorkshopStatus.PendingReview) {
        throw AppError.badRequest('Only workshops pending review can be approved or declined.');
      }

      const now = new Date();
      if (toStatus === WorkshopStatus.Planned) {
        if (workshop.fundingRequired) {
          const amount = approvedFundingAmount ?? (workshop.requestedFundingAmount === null
            ? undefined
            : Number(workshop.requestedFundingAmount));
          if (amount === undefined) throw AppError.badRequest('An approved funding amount is required.');
          workshop.approvedFundingAmount = amount.toFixed(2);
        } else {
          if (approvedFundingAmount !== undefined) throw AppError.badRequest('This workshop did not request funding.');
          workshop.approvedFundingAmount = null;
        }
        workshop.status = WorkshopStatus.Planned;
        workshop.approvedAt = now;
      } else {
        workshop.status = WorkshopStatus.Declined;
        workshop.declineReason = reason;
        workshop.declinedAt = now;
      }

      updated = await runner.manager.save(workshop);
      await runner.manager.save(runner.manager.create(WorkshopStatusHistory, {
        changedByAdminId: admin.adminId,
        changedByEmail: admin.email,
        changedByType: 'admin',
        fromStatus: WorkshopStatus.PendingReview,
        reason,
        toStatus,
        workshopId: workshop.id,
      }));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    const emailDeliveryMode = await this.sendDecisionEmail(updated, toStatus, reason);
    return { emailDeliveryMode, workshop: await this.getDetail(id) };
  }

  private async sendDecisionEmail(
    workshop: Workshop,
    status: WorkshopStatus.Planned | WorkshopStatus.Declined,
    reason: string | null,
  ): Promise<ReviewResult['emailDeliveryMode']> {
    const trackingUrl = new URL(`/workshops/${workshop.trackingToken}`, getEnv().APP_BASE_URL).toString();
    const approved = status === WorkshopStatus.Planned;
    const subject = approved
      ? `Workshop request ${workshop.workshopCode} approved`
      : `Workshop request ${workshop.workshopCode} declined`;
    const summary = approved
      ? `Your AI Envisioning Workshop request ${workshop.workshopCode} has been approved and is now planned.`
      : `Your AI Envisioning Workshop request ${workshop.workshopCode} has been declined.`;
    const funding = approved && workshop.approvedFundingAmount !== null
      ? `Approved funding: ${workshop.currencyCode} ${workshop.approvedFundingAmount}`
      : '';
    const text = [
      `Hello ${workshop.creatorName},`,
      '',
      summary,
      `Customer: ${workshop.customerName}`,
      funding,
      ...(approved ? [] : [`Reason: ${reason ?? 'No reason provided.'}`]),
      '',
      `Track your workshop: ${trackingUrl}`,
    ].filter((line) => line !== '').join('\n');
    const html = [
      '<!doctype html><html lang="en"><body>',
      `<p>Hello ${escapeHtml(workshop.creatorName)},</p>`,
      `<p>${escapeHtml(summary)}</p>`,
      `<p>Customer: ${escapeHtml(workshop.customerName)}</p>`,
      funding ? `<p>${escapeHtml(funding)}</p>` : '',
      approved ? '' : `<p>Reason: ${escapeHtml(reason ?? 'No reason provided.')}</p>`,
      `<p><a href="${escapeHtml(trackingUrl)}">Track your workshop</a></p>`,
      '</body></html>',
    ].join('');

    try {
      return await this.emailProvider.sendWorkshopConfirmation({
        html,
        recipient: workshop.creatorEmail,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error('Workshop decision email delivery failed', { err: error, workshopCode: workshop.workshopCode });
      return 'failed';
    }
  }

  private toDetail(
    workshop: Workshop,
    countryName: string,
    statusHistory: WorkshopStatusHistory[],
  ): Omit<AdminWorkshopDetail, 'execution' | 'files'> {
    return {
      approvedAt: workshop.approvedAt?.toISOString() ?? null,
      approvedFundingAmount: workshop.approvedFundingAmount,
      completedAt: workshop.completedAt?.toISOString() ?? null,
      countryCode: workshop.countryCode,
      countryName,
      createdAt: workshop.createdAt.toISOString(),
      creatorDomain: workshop.creatorDomain,
      creatorEmail: workshop.creatorEmail,
      creatorName: workshop.creatorName,
      currencyCode: workshop.currencyCode,
      declineReason: workshop.declineReason,
      declinedAt: workshop.declinedAt?.toISOString() ?? null,
      description: workshop.description,
      durationMinutes: workshop.durationMinutes,
      estimatedAttendees: workshop.estimatedAttendees,
      executionSupportDetails: workshop.executionSupportDetails,
      executionSupportRequired: workshop.executionSupportRequired,
      proofOverride: workshop.proofOverrideAt && workshop.proofOverrideByEmail && workshop.proofOverrideReason ? {
        email: workshop.proofOverrideByEmail,
        reason: workshop.proofOverrideReason,
        recordedAt: workshop.proofOverrideAt.toISOString(),
      } : null,
      fundingRequired: workshop.fundingRequired,
      location: workshop.location,
      plannedStartAt: workshop.plannedStartAt.toISOString(),
      requestedFundingAmount: workshop.requestedFundingAmount,
      requesterRole: workshop.requesterRole,
      status: workshop.status,
      statusHistory: statusHistory.map((entry) => ({
        changedByEmail: entry.changedByEmail,
        createdAt: entry.createdAt.toISOString(),
        fromStatus: entry.fromStatus,
        reason: entry.reason,
        toStatus: entry.toStatus,
      })),
      timezone: workshop.timezone,
      updatedAt: workshop.updatedAt.toISOString(),
      workshopCode: workshop.workshopCode,
    };
  }
}
