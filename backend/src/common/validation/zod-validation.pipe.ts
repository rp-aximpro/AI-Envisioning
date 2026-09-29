import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

import { AppError } from '../errors/app-error.js';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    void _metadata;
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed.', result.error.issues);
    }

    return result.data;
  }
}
