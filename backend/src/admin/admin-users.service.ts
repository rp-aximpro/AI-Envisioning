import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { AdminUser } from '../database/entities/admin-user.entity.js';

export interface AdminUserInput {
  displayName: string;
  email: string;
  password: string;
}

export interface AdminUserRecord {
  active: boolean;
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  lastLoginAt: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) return false;
  const driverError: unknown = error.driverError;
  return typeof driverError === 'object' && driverError !== null && 'code' in driverError && driverError.code === '23505';
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(AdminUser) private readonly adminRepository: Repository<AdminUser>,
  ) {}

  async list(): Promise<AdminUserRecord[]> {
    const admins = await this.adminRepository.find({ order: { email: 'ASC' } });
    return admins.map((admin) => this.toRecord(admin));
  }

  async create(input: AdminUserInput): Promise<AdminUserRecord> {
    const email = input.email.trim().toLowerCase();
    if (await this.adminRepository.findOne({ where: { email } })) {
      throw AppError.badRequest('An administrator with that email already exists.');
    }

    const admin = this.adminRepository.create({
      active: true,
      displayName: input.displayName.trim(),
      email,
      lastLoginAt: null,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
    });
    try {
      return this.toRecord(await this.adminRepository.save(admin));
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.badRequest('An administrator with that email already exists.');
      throw error;
    }
  }

  async setActive(id: string, active: boolean, actorId: string): Promise<AdminUserRecord> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw AppError.notFound('Administrator not found.');
    if (active === admin.active) return this.toRecord(admin);
    if (!active && admin.id === actorId) throw AppError.badRequest('You cannot deactivate your own administrator account.');

    if (!active && await this.adminRepository.countBy({ active: true }) <= 1) {
      throw AppError.badRequest('At least one active administrator must remain.');
    }

    admin.active = active;
    return this.toRecord(await this.adminRepository.save(admin));
  }

  private toRecord(admin: AdminUser): AdminUserRecord {
    return {
      active: admin.active,
      createdAt: admin.createdAt.toISOString(),
      displayName: admin.displayName,
      email: admin.email,
      id: admin.id,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    };
  }
}
