import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { RequesterRole } from '../database/entities/workshop.entity.js';
import { RequesterAccessService } from './requester-access.service.js';
import { readRequesterSessionToken } from './requester-session-cookie.js';
import { type CreatedWorkshop, WorkshopRequestService } from './workshop-request.service.js';

const isValidTimeZone = (timezone: string): boolean => {
  try {
    return Intl.DateTimeFormat(undefined, { timeZone: timezone }).resolvedOptions().timeZone === timezone;
  } catch {
    return false;
  }
};

const createWorkshopSchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    creatorName: z.string().trim().min(1).max(150),
    customerName: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000),
    durationMinutes: z.number().int().min(15).max(1440),
    estimatedAttendees: z.number().int().min(1).max(10_000),
    executionSupportDetails: z.string().trim().max(10_000).optional(),
    executionSupportRequired: z.boolean(),
    fundingRequired: z.boolean(),
    location: z.string().trim().min(1).max(300),
    plannedStartAt: z.string().datetime({ offset: true }),
    requestedFundingAmount: z.number().min(0).max(99_999_999_999.99).optional(),
    requesterRole: z.nativeEnum(RequesterRole),
    timezone: z.string().refine(isValidTimeZone, 'A valid IANA timezone is required.'),
  })
  .superRefine((value, context) => {
    if (value.executionSupportRequired && !value.executionSupportDetails) {
      context.addIssue({ code: 'custom', message: 'Execution support details are required.', path: ['executionSupportDetails'] });
    }
    if (value.fundingRequired && value.requestedFundingAmount === undefined) {
      context.addIssue({ code: 'custom', message: 'A funding amount is required.', path: ['requestedFundingAmount'] });
    }
  });

type CreateWorkshopBody = z.infer<typeof createWorkshopSchema>;

@Controller('api/requester/workshops')
export class WorkshopRequestController {
  constructor(
    @Inject(RequesterAccessService) private readonly requesterAccessService: RequesterAccessService,
    @Inject(WorkshopRequestService) private readonly workshopRequestService: WorkshopRequestService,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createWorkshopSchema)) input: CreateWorkshopBody,
    @Req() request: ApiRequest,
  ): Promise<CreatedWorkshop> {
    const requester = await this.requesterAccessService.getSession(readRequesterSessionToken(request));
    if (!requester) {
      throw AppError.unauthorized();
    }

    return this.workshopRequestService.create(
      {
        ...input,
        executionSupportDetails: input.executionSupportDetails ?? null,
        plannedStartAt: new Date(input.plannedStartAt),
        requestedFundingAmount: input.requestedFundingAmount?.toFixed(2) ?? null,
      },
      requester,
    );
  }
}
