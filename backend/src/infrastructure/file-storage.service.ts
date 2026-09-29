import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { AppError } from '../common/errors/app-error.js';
import { createS3Client } from './object-storage.js';
import { getEnv } from './env.js';

const localPrefix = 'local:';
const s3Prefix = 's3:';

@Injectable()
export class FileStorageService {
  private s3: ReturnType<typeof createS3Client> | undefined;

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const env = getEnv();
    this.validateKey(key);

    if (env.FILE_STORAGE_DRIVER === 's3') {
      await this.getS3Client().send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Body: body,
        ContentLength: body.byteLength,
        ContentType: contentType,
        Key: key,
      }));
      return `${s3Prefix}${key}`;
    }

    const target = this.localPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, { flag: 'wx', mode: 0o600 });
    return `${localPrefix}${key}`;
  }

  async get(storedKey: string): Promise<Readable> {
    const { driver, key } = this.parseStoredKey(storedKey);
    this.validateKey(key);
    if (driver === 'local') {
      const target = this.localPath(key);
      try {
        await access(target);
      } catch {
        throw AppError.notFound('File content not found.');
      }
      return createReadStream(target);
    }

    const result = await this.getS3Client().send(new GetObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key }));
    if (!result.Body) throw AppError.notFound('File content not found.');
    return Readable.from(result.Body as AsyncIterable<Uint8Array>);
  }

  async delete(storedKey: string): Promise<void> {
    const { driver, key } = this.parseStoredKey(storedKey);
    this.validateKey(key);
    if (driver === 'local') {
      await rm(this.localPath(key), { force: true });
      return;
    }
    await this.getS3Client().send(new DeleteObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key }));
  }

  private parseStoredKey(storedKey: string): { driver: 'local' | 's3'; key: string } {
    if (storedKey.startsWith(localPrefix)) return { driver: 'local', key: storedKey.slice(localPrefix.length) };
    if (storedKey.startsWith(s3Prefix)) return { driver: 's3', key: storedKey.slice(s3Prefix.length) };
    // Existing database rows predate the storage prefix and point to S3.
    return { driver: 's3', key: storedKey };
  }

  private localPath(key: string): string {
    const root = resolve(getEnv().LOCAL_FILE_STORAGE_DIR);
    const target = resolve(root, key);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw AppError.badRequest('Invalid file storage key.');
    }
    return target;
  }

  private getS3Client(): ReturnType<typeof createS3Client> {
    this.s3 ??= createS3Client();
    return this.s3;
  }

  private validateKey(key: string): void {
    if (!key || isAbsolute(key) || key.split(/[\\/]/).some((part) => part === '..' || part === '')) {
      throw AppError.badRequest('Invalid file storage key.');
    }
  }
}
