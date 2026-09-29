import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService, type HealthResponse } from './health.service.js';

@Controller('api/health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
