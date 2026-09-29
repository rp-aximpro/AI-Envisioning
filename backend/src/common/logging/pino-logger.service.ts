import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

import { getEnv } from '../../infrastructure/env.js';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    const env = getEnv();
    this.logger = pino({
      level: env.LOG_LEVEL,
      base: { service: 'ai-envision-api' },
      redact: ['password', 'passwordHash', 'authorization', 'cookie', 'set-cookie'],
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, this.messageText(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const fields = optionalParams[0];
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      this.logger.error(fields, this.messageText(message));
      return;
    }
    this.logger.error({ optionalParams }, this.messageText(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, this.messageText(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, this.messageText(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, this.messageText(message));
  }

  info(message: string, fields: Record<string, unknown> = {}): void {
    this.logger.info(fields, message);
  }

  requestCompleted(fields: Record<string, unknown>): void {
    this.logger.info(fields, 'Request completed');
  }

  private messageText(message: unknown): string {
    return typeof message === 'string' ? message : String(message);
  }
}
