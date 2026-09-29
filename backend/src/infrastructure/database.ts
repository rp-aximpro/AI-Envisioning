import { type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { AdminUser } from '../database/entities/admin-user.entity.js';
import { AdminSession } from '../database/entities/admin-session.entity.js';
import { AllowedDomain } from '../database/entities/allowed-domain.entity.js';
import { Country } from '../database/entities/country.entity.js';
import { OtpChallenge } from '../database/entities/otp-challenge.entity.js';
import { RequesterSession } from '../database/entities/requester-session.entity.js';
import { TrackingSession } from '../database/entities/tracking-session.entity.js';
import { WorkshopStatusHistory } from '../database/entities/workshop-status-history.entity.js';
import { WorkshopExecution } from '../database/entities/workshop-execution.entity.js';
import { WorkshopFile } from '../database/entities/workshop-file.entity.js';
import { SurveyAnswer } from '../database/entities/survey-answer.entity.js';
import { SurveyQuestion } from '../database/entities/survey-question.entity.js';
import { SurveySubmission } from '../database/entities/survey-submission.entity.js';
import { WorkshopLead } from '../database/entities/workshop-lead.entity.js';
import { WorkshopOpportunity } from '../database/entities/workshop-opportunity.entity.js';
import { Workshop } from '../database/entities/workshop.entity.js';
import { AddOtpChallenges1789387900000 } from '../database/migrations/1789387900000-add-otp-challenges.js';
import { AddRequesterSessions1789388000000 } from '../database/migrations/1789388000000-add-requester-sessions.js';
import { AddWorkshopCodeSequence1789388100000 } from '../database/migrations/1789388100000-add-workshop-code-sequence.js';
import { AddCountries1790700000000 } from '../database/migrations/1790700000000-add-countries.js';
import { AddTrackingSessions1790700000001 } from '../database/migrations/1790700000001-add-tracking-sessions.js';
import { AddAdminReview1790700000002 } from '../database/migrations/1790700000002-add-admin-review.js';
import { AddWorkshopExecution1790700000003 } from '../database/migrations/1790700000003-add-workshop-execution.js';
import { AddRepeatableSurveys1790700000004 } from '../database/migrations/1790700000004-add-repeatable-surveys.js';
import { AddWorkshopOutcomes1790700000005 } from '../database/migrations/1790700000005-add-workshop-outcomes.js';
import { InitialSchema1789387800000 } from '../database/migrations/1789387800000-initial-schema.js';
import { getEnv } from './env.js';

function createDataSourceOptions(): DataSourceOptions {
  const env = getEnv();

  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    entities: [AdminSession, AdminUser, AllowedDomain, Country, OtpChallenge, RequesterSession, SurveyAnswer, SurveyQuestion, SurveySubmission, TrackingSession, Workshop, WorkshopExecution, WorkshopFile, WorkshopLead, WorkshopOpportunity, WorkshopStatusHistory],
    migrations: [
      InitialSchema1789387800000,
      AddOtpChallenges1789387900000,
      AddRequesterSessions1789388000000,
      AddWorkshopCodeSequence1789388100000,
      AddCountries1790700000000,
      AddTrackingSessions1790700000001,
      AddAdminReview1790700000002,
      AddWorkshopExecution1790700000003,
      AddRepeatableSurveys1790700000004,
      AddWorkshopOutcomes1790700000005,
    ],
    synchronize: false,
  };
}

export function createTypeOrmOptions(): TypeOrmModuleOptions {
  return {
    ...createDataSourceOptions(),
    autoLoadEntities: true,
  };
}

export function createAppDataSource(): DataSource {
  return new DataSource(createDataSourceOptions());
}
