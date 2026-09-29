import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';

import { AppError, type AppErrorCode } from '../errors/app-error.js';
import { type ApiRequest, type ApiResponse } from '../http/request-response.types.js';
import { PinoLoggerService } from '../logging/pino-logger.service.js';

interface ErrorResponseBody {
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLoggerService,
    private readonly isProduction: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<ApiRequest>();
    const response = context.getResponse<ApiResponse>();
    const requestId = request.requestId ?? 'unknown';
    const normalized = this.normalize(exception);

    if (normalized.statusCode >= 500) {
      this.logger.error('Unhandled request error', {
        err: exception,
        method: request.method,
        path: request.originalUrl,
        requestId,
      });
    }

    const body: ErrorResponseBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
      },
      requestId,
    };

    response.status(normalized.statusCode).json(body);
  }

  private normalize(exception: unknown): AppError {
    if (exception instanceof AppError) {
      return exception;
    }

    if (exception instanceof ZodError) {
      return new AppError('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, 'Request validation failed.', exception.issues);
    }

    if (typeof exception === 'object' && exception !== null && 'code' in exception) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return new AppError('BAD_REQUEST', 413, 'A file exceeds the configured size limit.');
      }
      if (exception.code === 'LIMIT_FILE_COUNT' || exception.code === 'LIMIT_UNEXPECTED_FILE') {
        return AppError.badRequest('Too many or unexpected files were uploaded.');
      }
    }

    if (exception instanceof SyntaxError && 'body' in exception) {
      return AppError.badRequest('Malformed JSON request body.');
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const message = this.httpExceptionMessage(response, statusCode);

      return new AppError(
        statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        statusCode,
        message,
      );
    }

    return new AppError(
      'INTERNAL_SERVER_ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
      this.isProduction ? 'An unexpected error occurred.' : 'An unexpected error occurred. Check server logs for details.',
    );
  }

  private httpExceptionMessage(response: string | object, statusCode: number): string {
    if (typeof response === 'string') {
      return response;
    }

    if ('message' in response && typeof response.message === 'string') {
      return response.message;
    }

    return statusCode === 404
      ? 'The requested resource was not found.'
      : 'The request could not be processed.';
  }
}
