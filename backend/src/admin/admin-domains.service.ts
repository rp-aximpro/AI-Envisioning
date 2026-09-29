import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { AllowedDomain } from '../database/entities/allowed-domain.entity.js';

export interface AdminDomainInput {
  domain: string;
  displayName: string;
}

export interface AdminDomainUpdate {
  active?: boolean;
  displayName?: string;
  domain?: string;
}

export interface AdminDomainRecord {
  active: boolean;
  createdAt: string;
  displayName: string;
  domain: string;
  id: string;
  updatedAt: string;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) return false;
  const driverError: unknown = error.driverError;
  return typeof driverError === 'object' && driverError !== null && 'code' in driverError && driverError.code === '23505';
}

@Injectable()
export class AdminDomainsService {
  constructor(
    @InjectRepository(AllowedDomain) private readonly domainRepository: Repository<AllowedDomain>,
  ) {}

  async list(): Promise<AdminDomainRecord[]> {
    const domains = await this.domainRepository.find({ order: { domain: 'ASC' } });
    return domains.map((domain) => this.toRecord(domain));
  }

  async create(input: AdminDomainInput): Promise<AdminDomainRecord> {
    const domain = input.domain.trim().toLowerCase();
    if (await this.domainRepository.findOne({ where: { domain } })) {
      throw AppError.badRequest('That domain is already configured.');
    }

    const record = this.domainRepository.create({
      active: true,
      displayName: input.displayName.trim(),
      domain,
    });
    try {
      return this.toRecord(await this.domainRepository.save(record));
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.badRequest('That domain is already configured.');
      throw error;
    }
  }

  async update(id: string, input: AdminDomainUpdate): Promise<AdminDomainRecord> {
    const record = await this.domainRepository.findOne({ where: { id } });
    if (!record) throw AppError.notFound('Approved domain not found.');

    if (input.domain !== undefined) {
      const domain = input.domain.trim().toLowerCase();
      const existing = await this.domainRepository.findOne({ where: { domain } });
      if (existing && existing.id !== record.id) throw AppError.badRequest('That domain is already configured.');
      record.domain = domain;
    }
    if (input.displayName !== undefined) record.displayName = input.displayName.trim();
    if (input.active !== undefined) record.active = input.active;

    try {
      return this.toRecord(await this.domainRepository.save(record));
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.badRequest('That domain is already configured.');
      throw error;
    }
  }

  private toRecord(record: AllowedDomain): AdminDomainRecord {
    return {
      active: record.active,
      createdAt: record.createdAt.toISOString(),
      displayName: record.displayName,
      domain: record.domain,
      id: record.id,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
