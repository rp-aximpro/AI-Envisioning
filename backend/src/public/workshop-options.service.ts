import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';

import { Country } from '../database/entities/country.entity.js';
import { getEnv } from '../infrastructure/env.js';

export interface PublicCountry {
  code: string;
  name: string;
}

export interface WorkshopOptions {
  countries: PublicCountry[];
  programCurrency: string;
}

@Injectable()
export class WorkshopOptionsService {
  constructor(@InjectRepository(Country) private readonly countryRepository: Repository<Country>) {}

  async getOptions(): Promise<WorkshopOptions> {
    const countries = await this.countryRepository.find({
      order: { name: 'ASC' },
      select: { code: true, name: true },
      where: { active: true },
    });

    return { countries, programCurrency: getEnv().PROGRAM_CURRENCY };
  }
}
