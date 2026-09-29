import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { type Logger } from 'pino';

import { getEnv } from './env.js';

export function createS3Client(): S3Client {
  const env = getEnv();

  return new S3Client({
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    region: env.S3_REGION,
  });
}

export async function ensureStorageBucket(logger?: Pick<Logger, 'info' | 'warn'>): Promise<void> {
  const env = getEnv();
  const client = createS3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    logger?.info({ bucket: env.S3_BUCKET }, 'Object storage bucket is ready');
    return;
  } catch {
    logger?.warn({ bucket: env.S3_BUCKET }, 'Object storage bucket missing');
  }

  await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  await client.send(
    new PutBucketVersioningCommand({
      Bucket: env.S3_BUCKET,
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    }),
  );

  logger?.info({ bucket: env.S3_BUCKET }, 'Object storage bucket created');
}
