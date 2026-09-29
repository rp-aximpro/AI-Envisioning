import 'reflect-metadata';

import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminUser } from './database/entities/admin-user.entity.js';
import { AdminSession } from './database/entities/admin-session.entity.js';
import { AllowedDomain } from './database/entities/allowed-domain.entity.js';
import { Country } from './database/entities/country.entity.js';
import { Workshop } from './database/entities/workshop.entity.js';
import { OtpChallenge } from './database/entities/otp-challenge.entity.js';
import { RequesterSession } from './database/entities/requester-session.entity.js';
import { TrackingSession } from './database/entities/tracking-session.entity.js';
import { WorkshopStatusHistory } from './database/entities/workshop-status-history.entity.js';
import { WorkshopExecution } from './database/entities/workshop-execution.entity.js';
import { WorkshopFile } from './database/entities/workshop-file.entity.js';
import { SurveyAnswer } from './database/entities/survey-answer.entity.js';
import { SurveyQuestion } from './database/entities/survey-question.entity.js';
import { SurveySubmission } from './database/entities/survey-submission.entity.js';
import { WorkshopLead } from './database/entities/workshop-lead.entity.js';
import { WorkshopOpportunity } from './database/entities/workshop-opportunity.entity.js';
import { PinoLoggerService } from './common/logging/pino-logger.service.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { EMAIL_PROVIDER } from './email/email-provider.js';
import { SendGridEmailProvider } from './email/sendgrid-email.provider.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { createTypeOrmOptions } from './infrastructure/database.js';
import { StorageBootstrapService } from './infrastructure/storage-bootstrap.service.js';
import { OtpService } from './otp/otp.service.js';
import { RequesterAccessController } from './requester/requester-access.controller.js';
import { RequesterAccessService } from './requester/requester-access.service.js';
import { RequesterSessionService } from './requester/requester-session.service.js';
import { WorkshopRequestController } from './requester/workshop-request.controller.js';
import { WorkshopRequestService } from './requester/workshop-request.service.js';
import { TrackingSessionService } from './requester/tracking-session.service.js';
import { WorkshopTrackingController } from './requester/workshop-tracking.controller.js';
import { WorkshopTrackingService } from './requester/workshop-tracking.service.js';
import { WorkshopExecutionService } from './requester/workshop-execution.service.js';
import { RequireTrackingWorkshopGuard } from './requester/require-tracking-workshop.guard.js';
import { AdminAuthController } from './admin/admin-auth.controller.js';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AdminWorkshopsController } from './admin/admin-workshops.controller.js';
import { AdminWorkshopsService } from './admin/admin-workshops.service.js';
import { RequireAdminGuard } from './admin/require-admin.guard.js';
import { WorkshopOptionsController } from './public/workshop-options.controller.js';
import { WorkshopOptionsService } from './public/workshop-options.service.js';
import { WorkshopSurveyController } from './requester/workshop-survey.controller.js';
import { WorkshopSurveyService } from './requester/workshop-survey.service.js';
import { WorkshopOutcomeController } from './requester/workshop-outcome.controller.js';
import { WorkshopOutcomeService } from './requester/workshop-outcome.service.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(createTypeOrmOptions()),
    TypeOrmModule.forFeature([AdminSession, AdminUser, AllowedDomain, Country, OtpChallenge, RequesterSession, SurveyAnswer, SurveyQuestion, SurveySubmission, TrackingSession, Workshop, WorkshopExecution, WorkshopFile, WorkshopLead, WorkshopOpportunity, WorkshopStatusHistory]),
  ],
  controllers: [HealthController, RequesterAccessController, WorkshopOptionsController, WorkshopRequestController, WorkshopTrackingController, WorkshopSurveyController, WorkshopOutcomeController, AdminAuthController, AdminWorkshopsController],
  providers: [
    HealthService,
    PinoLoggerService,
    RequestIdMiddleware,
    StorageBootstrapService,
    OtpService,
    RequesterAccessService,
    RequesterSessionService,
    WorkshopRequestService,
    TrackingSessionService,
    WorkshopTrackingService,
    WorkshopSurveyService,
    WorkshopOutcomeService,
    WorkshopExecutionService,
    RequireTrackingWorkshopGuard,
    AdminAuthService,
    AdminWorkshopsService,
    RequireAdminGuard,
    WorkshopOptionsService,
    SendGridEmailProvider,
    { provide: EMAIL_PROVIDER, useExisting: SendGridEmailProvider },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
