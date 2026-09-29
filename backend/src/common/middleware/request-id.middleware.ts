import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

import { type ApiRequest, type ApiResponse } from '../http/request-response.types.js';
import { getEnv } from '../../infrastructure/env.js';

const REQUEST_ID_HEADER = 'x-request-id';
const validRequestId = /^[A-Za-z0-9_-]{8,128}$/;
const requestLogger = pino({
  level: getEnv().LOG_LEVEL,
  base: { service: 'ai-envision-api' },
});

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: ApiResponse, next: (error?: unknown) => void): void {
    const suppliedRequestId = request.header(REQUEST_ID_HEADER);
    const requestId = suppliedRequestId && validRequestId.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
    const startedAt = performance.now();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.on('finish', () => {
      requestLogger.info({
        durationMs: Math.round(performance.now() - startedAt),
        method: request.method,
        path: request.originalUrl,
        requestId,
        statusCode: response.statusCode,
      }, 'Request completed');
    });

    next();
  }
}
