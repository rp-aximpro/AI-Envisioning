import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { WorkshopLead } from '../database/entities/workshop-lead.entity.js';
import { WorkshopOpportunity } from '../database/entities/workshop-opportunity.entity.js';
import { WorkshopStatusHistory } from '../database/entities/workshop-status-history.entity.js';
import { Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { TrackingSessionService, type TrackingIdentity } from './tracking-session.service.js';

export interface WorkshopLeadInput {
  description?: string | null;
  leadReference?: string | null;
}

export interface WorkshopOpportunityInput {
  name: string;
  notes?: string | null;
  opportunityReference?: string | null;
  pipelineValue: string;
  stage?: string | null;
}

export interface WorkshopOutcomeInput {
  actualFundingAmount?: string | null;
  completionNotes: string;
  leads: WorkshopLeadInput[];
  opportunities: WorkshopOpportunityInput[];
}

export interface WorkshopLeadDetails {
  createdAt: string;
  createdByEmail: string;
  description: string | null;
  id: string;
  leadReference: string | null;
}

export interface WorkshopOpportunityDetails {
  createdAt: string;
  createdByEmail: string;
  currencyCode: string;
  id: string;
  name: string;
  notes: string | null;
  opportunityReference: string | null;
  pipelineValue: string;
  stage: string | null;
}

export interface WorkshopOutcomeDetails {
  actualFundingAmount: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  leadCount: number;
  leads: WorkshopLeadDetails[];
  opportunityCount: number;
  opportunities: WorkshopOpportunityDetails[];
  totalPipelineValue: string;
}

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

@Injectable()
export class WorkshopOutcomeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(WorkshopLead) private readonly leadRepository: Repository<WorkshopLead>,
    @InjectRepository(WorkshopOpportunity) private readonly opportunityRepository: Repository<WorkshopOpportunity>,
    @Inject(TrackingSessionService) private readonly trackingSessions: TrackingSessionService,
  ) {}

  async completeWorkshop(
    trackingToken: string,
    sessionToken: string | undefined,
    input: WorkshopOutcomeInput,
  ): Promise<void> {
    const { identity, workshop } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    const leads = input.leads.map((lead) => this.normalizeLead(lead));
    const opportunities = input.opportunities.map((opportunity) => this.normalizeOpportunity(opportunity));
    const completionNotes = input.completionNotes.trim();
    const actualFundingAmount = input.actualFundingAmount ? this.normalizeMoney(input.actualFundingAmount) : null;

    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, {
        lock: { mode: 'pessimistic_write' },
        where: { id: workshop.id },
      });
      if (!locked) throw AppError.notFound('Workshop not found.');
      if (locked.status !== WorkshopStatus.FollowUp) {
        throw AppError.badRequest('Only follow-up workshops can be completed.');
      }
      if (locked.fundingRequired && actualFundingAmount === null) {
        throw AppError.badRequest('Enter the actual funding amount before completing this workshop.');
      }
      if (!locked.fundingRequired && actualFundingAmount !== null) {
        throw AppError.badRequest('Actual funding cannot be entered for a workshop without approved funding.');
      }
      if (locked.fundingRequired && locked.approvedFundingAmount === null) {
        throw AppError.badRequest('Funding must be approved before actual funding can be finalized.');
      }
      if (actualFundingAmount !== null && locked.approvedFundingAmount !== null && this.toCents(actualFundingAmount) > this.toCents(locked.approvedFundingAmount)) {
        throw AppError.badRequest('Actual funding cannot exceed the approved amount.');
      }

      if (leads.length > 0) {
        await runner.manager.save(leads.map((lead) => runner.manager.create(WorkshopLead, {
          ...lead,
          createdByEmail: identity.email,
          workshopId: locked.id,
        })));
      }
      if (opportunities.length > 0) {
        await runner.manager.save(opportunities.map((opportunity) => runner.manager.create(WorkshopOpportunity, {
          ...opportunity,
          createdByEmail: identity.email,
          currencyCode: locked.currencyCode,
          workshopId: locked.id,
        })));
      }

      locked.actualFundingAmount = actualFundingAmount;
      locked.completionNotes = completionNotes || null;
      locked.completedAt = new Date();
      locked.status = WorkshopStatus.Completed;
      await runner.manager.save(locked);
      await runner.manager.save(runner.manager.create(WorkshopStatusHistory, {
        changedByEmail: identity.email,
        changedByType: 'requester',
        fromStatus: WorkshopStatus.FollowUp,
        reason: 'Requester submitted workshop outcomes and completed the workshop.',
        toStatus: WorkshopStatus.Completed,
        workshopId: locked.id,
      }));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async getOutcome(workshopId: string): Promise<WorkshopOutcomeDetails> {
    const [workshop, leads, opportunities, pipelineTotal] = await Promise.all([
      this.workshopRepository.findOne({ where: { id: workshopId } }),
      this.leadRepository.find({ order: { createdAt: 'ASC', id: 'ASC' }, where: { workshopId } }),
      this.opportunityRepository.find({ order: { createdAt: 'ASC', id: 'ASC' }, where: { workshopId } }),
      this.opportunityRepository.createQueryBuilder('opportunity')
        .select('COALESCE(SUM(opportunity.pipelineValue), 0)', 'total')
        .where('opportunity.workshopId = :workshopId', { workshopId })
        .getRawOne<{ total: string }>(),
    ]);
    if (!workshop) throw AppError.notFound('Workshop not found.');

    return {
      actualFundingAmount: workshop.actualFundingAmount,
      completedAt: workshop.completedAt?.toISOString() ?? null,
      completionNotes: workshop.completionNotes,
      leadCount: leads.length,
      leads: leads.map((lead) => ({
        createdAt: lead.createdAt.toISOString(),
        createdByEmail: lead.createdByEmail,
        description: lead.description,
        id: lead.id,
        leadReference: lead.leadReference,
      })),
      opportunityCount: opportunities.length,
      opportunities: opportunities.map((opportunity) => ({
        createdAt: opportunity.createdAt.toISOString(),
        createdByEmail: opportunity.createdByEmail,
        currencyCode: opportunity.currencyCode,
        id: opportunity.id,
        name: opportunity.name,
        notes: opportunity.notes,
        opportunityReference: opportunity.opportunityReference,
        pipelineValue: opportunity.pipelineValue,
        stage: opportunity.stage,
      })),
      totalPipelineValue: this.normalizeAggregateMoney(String(pipelineTotal?.total ?? '0')),
    };
  }

  private async getAuthorizedWorkshop(
    trackingToken: string,
    sessionToken: string | undefined,
  ): Promise<{ identity: TrackingIdentity; workshop: Workshop }> {
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop) throw AppError.notFound('Workshop not found.');
    const identity = await this.trackingSessions.getIdentity(sessionToken, workshop.id);
    if (!identity || identity.domain !== workshop.creatorDomain) throw AppError.unauthorized();
    return { identity, workshop };
  }

  private normalizeLead(input: WorkshopLeadInput): Omit<WorkshopLead, 'id' | 'createdAt' | 'createdByEmail' | 'workshopId'> {
    const leadReference = this.optionalText(input.leadReference);
    const description = this.optionalText(input.description);
    if (!leadReference && !description) throw AppError.badRequest('Each lead needs a reference or description.');
    return { description, leadReference };
  }

  private normalizeOpportunity(input: WorkshopOpportunityInput): Omit<WorkshopOpportunity, 'id' | 'createdAt' | 'createdByEmail' | 'workshopId' | 'currencyCode'> {
    const name = input.name.trim();
    if (!name) throw AppError.badRequest('Each opportunity needs a name.');
    return {
      name,
      notes: this.optionalText(input.notes),
      opportunityReference: this.optionalText(input.opportunityReference),
      pipelineValue: this.normalizeMoney(input.pipelineValue),
      stage: this.optionalText(input.stage),
    };
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  private normalizeMoney(value: string): string {
    if (!moneyPattern.test(value)) throw AppError.badRequest('Enter a valid non-negative amount with up to two decimal places.');
    const [wholePart, fraction = ''] = value.split('.');
    const whole = wholePart ?? '0';
    return `${whole}.${fraction.padEnd(2, '0')}`;
  }

  private normalizeAggregateMoney(value: string): string {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw AppError.badRequest('The pipeline total could not be calculated.');
    const [wholePart, fraction = ''] = value.split('.');
    const whole = wholePart ?? '0';
    return `${whole}.${fraction.padEnd(2, '0')}`;
  }

  private toCents(value: string): bigint {
    const [wholePart, fraction = ''] = this.normalizeMoney(value).split('.');
    const whole = wholePart ?? '0';
    return BigInt(whole) * 100n + BigInt(fraction);
  }
}
