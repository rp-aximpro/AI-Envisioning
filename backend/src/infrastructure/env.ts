import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default('admin@example.local'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).default('change-me'),
  ADMIN_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  ADMIN_LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  ADMIN_SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  ADMIN_SESSION_IDLE_TTL_MINUTES: z.coerce.number().int().min(1).max(240).default(30),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/ai_envision'),
  EMAIL_FROM: z.string().min(1).default('AI Envisioning Workshops <no-reply@example.local>'),
  LOG_LEVEL: z.string().default('info'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(104_857_600).default(10_485_760),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
  OTP_SECRET: z.string().min(16).default('change-me-in-development'),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  PROGRAM_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  REQUESTER_SESSION_TTL_MINUTES: z.coerce.number().int().min(1).max(480).default(60),
  S3_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  S3_BUCKET: z.string().min(1).default('ai-envision-workshop-files'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_SECRET_KEY: z.string().min(1).default('minioadmin'),
  SESSION_SECRET: z.string().min(16).default('change-me-in-development'),
  TRACKING_SESSION_TTL_MINUTES: z.coerce.number().int().min(1).max(480).default(480),
  SENDGRID_API_KEY: z.string().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
