import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { type DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { WorkshopExecution } from '../database/entities/workshop-execution.entity.js';
import { WorkshopFile } from '../database/entities/workshop-file.entity.js';
import { Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { WorkshopStatusHistory } from '../database/entities/workshop-status-history.entity.js';
import { createS3Client } from '../infrastructure/object-storage.js';
import { getEnv } from '../infrastructure/env.js';
import { TrackingSessionService, type TrackingIdentity } from './tracking-session.service.js';

const maxFileCount = 10;
const proofMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export interface UploadedProofFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ExecutionSubmission {
  actualAttendees: number;
  notes: string;
}

export interface WorkshopFileDetails {
  createdAt: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  uploadedByEmail: string;
}

export interface WorkshopExecutionDetails {
  actualAttendees: number;
  notes: string;
  submittedAt: string;
  submittedByEmail: string;
}

export interface ExecutionProofOverride {
  email: string;
  reason: string;
  recordedAt: string;
}

export interface DownloadableWorkshopFile {
  mimeType: string;
  originalFilename: string;
  stream: Readable;
}

interface ValidatedProofFile {
  keyFilename: string;
  mimeType: string;
  objectKey: string;
  originalFilename: string;
  upload: UploadedProofFile;
}

@Injectable()
export class WorkshopExecutionService {
  private readonly storage = createS3Client();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(WorkshopExecution) private readonly executionRepository: Repository<WorkshopExecution>,
    @InjectRepository(WorkshopFile) private readonly fileRepository: Repository<WorkshopFile>,
    @Inject(TrackingSessionService) private readonly trackingSessions: TrackingSessionService,
  ) {}

  async markPlannedComplete(trackingToken: string, sessionToken: string | undefined): Promise<void> {
    const { identity, workshop } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, { lock: { mode: 'pessimistic_write' }, where: { id: workshop.id } });
      if (!locked) throw AppError.notFound('Workshop not found.');
      if (locked.status !== WorkshopStatus.Planned) throw AppError.badRequest('Only planned workshops can be marked complete.');
      locked.status = WorkshopStatus.Executed;
      await runner.manager.save(locked);
      await runner.manager.save(runner.manager.create(WorkshopStatusHistory, {
        changedByEmail: identity.email,
        changedByType: 'requester',
        fromStatus: WorkshopStatus.Planned,
        reason: 'Requester marked the planned phase complete.',
        toStatus: WorkshopStatus.Executed,
        workshopId: locked.id,
      }));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async submitExecution(
    trackingToken: string,
    sessionToken: string | undefined,
    input: ExecutionSubmission,
    files: UploadedProofFile[],
  ): Promise<void> {
    const { workshop, identity } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    const env = getEnv();
    if (workshop.status !== WorkshopStatus.Executed) {
      throw AppError.badRequest('Mark the planned phase complete before submitting execution details.');
    }
    const safeFiles = this.validateProofFiles(files, Boolean(workshop.proofOverrideAt));
    const objectKeys: string[] = [];
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      for (const file of safeFiles) {
        const objectKey = `workshops/${workshop.id}/execution/${randomUUID()}-${file.keyFilename}`;
        await this.storage.send(new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Body: file.upload.buffer,
          ContentLength: file.upload.size,
          ContentType: file.mimeType,
          Key: objectKey,
        }));
        objectKeys.push(objectKey);
        file.objectKey = objectKey;
      }

      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, { lock: { mode: 'pessimistic_write' }, where: { id: workshop.id } });
      if (!locked) throw AppError.notFound('Workshop not found.');
      if (locked.status !== WorkshopStatus.Executed) throw AppError.badRequest('Mark the planned phase complete before submitting execution details.');
      if (files.length < 1 && !locked.proofOverrideAt) throw AppError.badRequest('An administrator must record a proof override before submitting without a file.');
      const existing = await runner.manager.findOne(WorkshopExecution, { where: { workshopId: locked.id } });
      if (existing) throw AppError.badRequest('Execution details have already been submitted.');

      const submittedAt = new Date();
      await runner.manager.save(runner.manager.create(WorkshopExecution, {
        actualAttendees: input.actualAttendees,
        notes: input.notes.trim(),
        submittedAt,
        submittedByEmail: identity.email,
        workshopId: locked.id,
      }));
      await runner.manager.save(safeFiles.map((file) => runner.manager.create(WorkshopFile, {
        category: 'execution_proof',
        mimeType: file.mimeType,
        objectKey: file.objectKey,
        originalFilename: file.originalFilename,
        sizeBytes: String(file.upload.size),
        uploadedByEmail: identity.email,
        workshopId: locked.id,
      })));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await this.deleteObjects(objectKeys, env.S3_BUCKET);
      throw error;
    } finally {
      await runner.release();
    }
  }

  async addProofFiles(
    trackingToken: string,
    sessionToken: string | undefined,
    files: UploadedProofFile[],
  ): Promise<void> {
    const { workshop, identity } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    if (workshop.status !== WorkshopStatus.Executed && workshop.status !== WorkshopStatus.FollowUp) {
      throw AppError.badRequest('Additional proof files can only be added during execution or follow-up.');
    }
    if (!await this.executionRepository.findOne({ where: { workshopId: workshop.id } })) {
      throw AppError.badRequest('Execution details must be submitted before adding proof files.');
    }
    const safeFiles = this.validateProofFiles(files);
    const env = getEnv();
    const objectKeys: string[] = [];
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      for (const file of safeFiles) {
        const objectKey = `workshops/${workshop.id}/execution/${randomUUID()}-${file.keyFilename}`;
        await this.storage.send(new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Body: file.upload.buffer,
          ContentLength: file.upload.size,
          ContentType: file.mimeType,
          Key: objectKey,
        }));
        objectKeys.push(objectKey);
        file.objectKey = objectKey;
      }

      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, { lock: { mode: 'pessimistic_write' }, where: { id: workshop.id } });
      if (!locked || (locked.status !== WorkshopStatus.Executed && locked.status !== WorkshopStatus.FollowUp)) {
        throw AppError.badRequest('Additional proof files can only be added during execution or follow-up.');
      }
      const execution = await runner.manager.findOne(WorkshopExecution, { where: { workshopId: locked.id } });
      if (!execution) throw AppError.badRequest('Execution details must be submitted before adding proof files.');
      await runner.manager.save(safeFiles.map((file) => runner.manager.create(WorkshopFile, {
        category: 'execution_proof',
        mimeType: file.mimeType,
        objectKey: file.objectKey,
        originalFilename: file.originalFilename,
        sizeBytes: String(file.upload.size),
        uploadedByEmail: identity.email,
        workshopId: locked.id,
      })));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await this.deleteObjects(objectKeys, env.S3_BUCKET);
      throw error;
    } finally {
      await runner.release();
    }
  }

  async markExecutedComplete(trackingToken: string, sessionToken: string | undefined): Promise<void> {
    const { workshop, identity } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, { lock: { mode: 'pessimistic_write' }, where: { id: workshop.id } });
      if (!locked) throw AppError.notFound('Workshop not found.');
      if (locked.status !== WorkshopStatus.Executed) throw AppError.badRequest('Only executed workshops can be marked complete.');
      const execution = await runner.manager.findOne(WorkshopExecution, { where: { workshopId: locked.id } });
      if (!execution) throw AppError.badRequest('Submit execution details before marking this phase complete.');
      const proofFile = await runner.manager.findOne(WorkshopFile, { where: { workshopId: locked.id } });
      if (!proofFile && !locked.proofOverrideAt) {
        throw AppError.badRequest('At least one proof file or an admin waiver is required to complete this phase.');
      }
      locked.status = WorkshopStatus.FollowUp;
      await runner.manager.save(locked);
      await runner.manager.save(runner.manager.create(WorkshopStatusHistory, {
        changedByEmail: identity.email,
        changedByType: 'requester',
        fromStatus: WorkshopStatus.Executed,
        reason: 'Requester marked the executed phase complete.',
        toStatus: WorkshopStatus.FollowUp,
        workshopId: locked.id,
      }));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async getExecutionDetails(workshopId: string): Promise<{
    execution: WorkshopExecutionDetails | null;
    files: WorkshopFileDetails[];
  }> {
    const [execution, files] = await Promise.all([
      this.executionRepository.findOne({ where: { workshopId } }),
      this.fileRepository.find({ order: { createdAt: 'ASC' }, where: { workshopId } }),
    ]);
    return {
      execution: execution ? {
        actualAttendees: execution.actualAttendees,
        notes: execution.notes,
        submittedAt: execution.submittedAt.toISOString(),
        submittedByEmail: execution.submittedByEmail,
      } : null,
      files: files.map((file) => ({
        createdAt: file.createdAt.toISOString(),
        id: file.id,
        mimeType: file.mimeType,
        originalFilename: file.originalFilename,
        sizeBytes: Number(file.sizeBytes),
        uploadedByEmail: file.uploadedByEmail,
      })),
    };
  }

  async downloadForTracking(
    trackingToken: string,
    sessionToken: string | undefined,
    fileId: string,
  ): Promise<DownloadableWorkshopFile> {
    const { workshop } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    return this.download(workshop.id, fileId);
  }

  downloadForAdmin(workshopId: string, fileId: string): Promise<DownloadableWorkshopFile> {
    return this.download(workshopId, fileId);
  }

  private async getAuthorizedWorkshop(
    trackingToken: string,
    sessionToken: string | undefined,
  ): Promise<{ identity: TrackingIdentity; workshop: Workshop }> {
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop) throw AppError.notFound('Workshop not found.');
    const identity = await this.trackingSessions.getIdentity(sessionToken, workshop.id);
    if (!identity || identity.domain !== workshop.creatorDomain) throw AppError.unauthorized();
    return { identity, workshop };
  }

  private async download(workshopId: string, fileId: string): Promise<DownloadableWorkshopFile> {
    const file = await this.fileRepository.findOne({ where: { id: fileId, workshopId } });
    if (!file) throw AppError.notFound('File not found.');
    const result = await this.storage.send(new GetObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: file.objectKey }));
    if (!result.Body) throw AppError.notFound('File content not found.');
    return {
      mimeType: file.mimeType,
      originalFilename: file.originalFilename,
      stream: Readable.from(result.Body as AsyncIterable<Uint8Array>),
    };
  }

  private validateProofFiles(files: UploadedProofFile[], allowEmpty = false): ValidatedProofFile[] {
    const maxUploadBytes = getEnv().MAX_UPLOAD_BYTES;
    if (files.length === 0 && !allowEmpty) throw AppError.badRequest('Upload at least one proof file.');
    if (files.length > maxFileCount) throw AppError.badRequest(`Upload no more than ${maxFileCount} files.`);
    if (files.some((file) => file.size > maxUploadBytes)) {
      throw new AppError('BAD_REQUEST', 413, 'A file exceeds the configured size limit.');
    }
    if (files.reduce((total, file) => total + file.size, 0) > maxUploadBytes) {
      throw new AppError('BAD_REQUEST', 413, 'The total upload exceeds the configured size limit.');
    }
    return files.map((file) => this.validateProofFile(file));
  }

  private validateProofFile(file: UploadedProofFile): ValidatedProofFile {
    const name = file.originalname.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? '';
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
    const expected = extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.png'
        ? 'image/png'
        : extension === '.pdf'
          ? 'application/pdf'
          : '';
    const isJpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
    const isPng = file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isPdf = file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const detectedMime = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isPdf ? 'application/pdf' : '';
    if (file.size !== file.buffer.byteLength || !name || !proofMimeTypes.has(file.mimetype) || file.mimetype !== expected || file.mimetype !== detectedMime) {
      throw AppError.badRequest('Only valid JPEG, PNG, and PDF proof files are accepted.');
    }
    const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || `proof${extension}`;
    return {
      keyFilename: safeName,
      mimeType: file.mimetype,
      objectKey: '',
      originalFilename: name.slice(0, 255),
      upload: file,
    };
  }

  private async deleteObjects(objectKeys: string[], bucket: string): Promise<void> {
    await Promise.allSettled(objectKeys.map((Key) => this.storage.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
  }
}
