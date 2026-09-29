import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { readTrackingSessionToken } from './tracking-session-cookie.js';
import { WorkshopOutcomeService } from './workshop-outcome.service.js';

const optionalText = (maxLength: number) => z.string().trim().max(maxLength).nullable().optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const workshopOutcomeSchema = z.object({
  actualFundingAmount: money.nullable().optional(),
  completionNotes: z.string().trim().max(10_000).default(''),
  leads: z.array(z.object({
    description: optionalText(5_000),
    leadReference: optionalText(150),
  })).max(100).default([]),
  opportunities: z.array(z.object({
    name: z.string().trim().max(200),
    notes: optionalText(5_000),
    opportunityReference: optionalText(150),
    pipelineValue: money,
    stage: optionalText(100),
  })).max(100).default([]),
});

type WorkshopOutcomeBody = z.infer<typeof workshopOutcomeSchema>;

@Controller()
export class WorkshopOutcomeController {
  constructor(@Inject(WorkshopOutcomeService) private readonly outcomeService: WorkshopOutcomeService) {}

  @Post('api/tracking/workshops/:trackingToken/complete')
  @HttpCode(204)
  async completeWorkshop(
    @Param('trackingToken') trackingToken: string,
    @Req() request: ApiRequest,
    @Body(new ZodValidationPipe(workshopOutcomeSchema)) input: WorkshopOutcomeBody,
  ): Promise<void> {
    await this.outcomeService.completeWorkshop(trackingToken, readTrackingSessionToken(request), input);
  }
}
