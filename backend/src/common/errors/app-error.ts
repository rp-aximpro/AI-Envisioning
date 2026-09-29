export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'UNAUTHORIZED'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError('BAD_REQUEST', 400, message, details);
  }

  static notFound(message = 'The requested resource was not found.'): AppError {
    return new AppError('NOT_FOUND', 404, message);
  }

  static tooManyRequests(message: string): AppError {
    return new AppError('TOO_MANY_REQUESTS', 429, message);
  }

  static unauthorized(message = 'Authentication is required.'): AppError {
    return new AppError('UNAUTHORIZED', 401, message);
  }
}
