import { Controller, Get, Inject } from '@nestjs/common';

import { WorkshopOptionsService, type WorkshopOptions } from './workshop-options.service.js';

@Controller('api/public/workshop-options')
export class WorkshopOptionsController {
  constructor(@Inject(WorkshopOptionsService) private readonly optionsService: WorkshopOptionsService) {}

  @Get()
  getOptions(): Promise<WorkshopOptions> {
    return this.optionsService.getOptions();
  }
}
