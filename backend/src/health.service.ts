import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({ status: 'ok' });
  }
}
