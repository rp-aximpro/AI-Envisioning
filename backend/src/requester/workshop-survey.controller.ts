import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { readTrackingSessionToken } from './tracking-session-cookie.js';
import { WorkshopSurveyService } from './workshop-survey.service.js';

const surveySubmissionSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  respondentCompany: z.string().trim().max(200).nullable().optional(),
  respondentName: z.string().trim().max(150).nullable().optional(),
});

type SurveySubmissionBody = z.infer<typeof surveySubmissionSchema>;

@Controller()
export class WorkshopSurveyController {
  constructor(@Inject(WorkshopSurveyService) private readonly surveyService: WorkshopSurveyService) {}

  @Get('api/tracking/workshops/:trackingToken/survey')
  getSurvey(@Param('trackingToken') trackingToken: string, @Req() request: ApiRequest) {
    return this.surveyService.getSurvey(trackingToken, readTrackingSessionToken(request));
  }

  @Post('api/tracking/workshops/:trackingToken/surveys')
  submitSurvey(
    @Param('trackingToken') trackingToken: string,
    @Req() request: ApiRequest,
    @Body(new ZodValidationPipe(surveySubmissionSchema)) input: SurveySubmissionBody,
  ) {
    return this.surveyService.submitSurvey(trackingToken, readTrackingSessionToken(request), input);
  }

  @Post('api/tracking/workshops/:trackingToken/mark-survey-complete')
  @HttpCode(204)
  async markSurveyComplete(@Param('trackingToken') trackingToken: string, @Req() request: ApiRequest): Promise<void> {
    await this.surveyService.markSurveyComplete(trackingToken, readTrackingSessionToken(request));
  }
}
