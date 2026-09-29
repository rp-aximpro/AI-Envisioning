import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { PinoLoggerService } from './common/logging/pino-logger.service.js';
import { getEnv } from './infrastructure/env.js';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule);

  app.useLogger(app.get(PinoLoggerService));
  app.useGlobalFilters(new ApiExceptionFilter(app.get(PinoLoggerService), env.NODE_ENV === 'production'));
  app.use(helmet());
  app.enableCors({
    origin: env.APP_BASE_URL,
    credentials: true,
  });

  await app.listen(env.API_PORT);
}

void bootstrap();
