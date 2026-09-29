import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { type ApiRequest, type ApiResponse } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { RequesterRole, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { type AdminIdentity } from './admin-auth.service.js';
import { RequireAdminGuard } from './require-admin.guard.js';
import { AdminWorkshopsService, type ReviewResult } from './admin-workshops.service.js';
import { WorkshopExecutionService } from '../requester/workshop-execution.service.js';

const listQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  creator: z.string().trim().max(320).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  requesterRole: z.nativeEnum(RequesterRole).optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['workshopCode', 'customerName', 'creatorName', 'plannedStartAt', 'status', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.nativeEnum(WorkshopStatus).optional(),
});
const idSchema = z.string().uuid();
const approveSchema = z.object({
  approvedFundingAmount: z.number().min(0).max(99_999_999_999.99).optional(),
});
const declineSchema = z.object({ reason: z.string().trim().min(1, 'A decline reason is required.').max(5000) });
const proofOverrideSchema = z.object({ reason: z.string().trim().min(1, 'A reason is required.').max(5000) });

type ListQuery = z.infer<typeof listQuerySchema>;
type ApproveInput = z.infer<typeof approveSchema>;
type DeclineInput = z.infer<typeof declineSchema>;
type ProofOverrideInput = z.infer<typeof proofOverrideSchema>;

function requireIdentity(request: ApiRequest): AdminIdentity {
  if (!request.adminIdentity) throw AppError.unauthorized();
  return request.adminIdentity;
}

@Controller('api/admin/workshops')
@UseGuards(RequireAdminGuard)
export class AdminWorkshopsController {
  constructor(
    @Inject(AdminWorkshopsService) private readonly workshopsService: AdminWorkshopsService,
    @Inject(WorkshopExecutionService) private readonly executionService: WorkshopExecutionService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    return this.workshopsService.list(query);
  }

  @Get(':id')
  getDetail(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.workshopsService.getDetail(id);
  }

  @Get(':id/files/:fileId/download')
  async downloadFile(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Param('fileId', new ZodValidationPipe(idSchema)) fileId: string,
    @Res() response: ApiResponse,
  ): Promise<void> {
    const file = await this.executionService.downloadForAdmin(id, fileId);
    this.streamDownload(response, file);
  }

  @Post(':id/approve')
  approve(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(approveSchema)) input: ApproveInput,
    @Req() request: ApiRequest,
  ): Promise<ReviewResult> {
    return this.workshopsService.approve(id, input.approvedFundingAmount, requireIdentity(request));
  }

  @Post(':id/decline')
  decline(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(declineSchema)) input: DeclineInput,
    @Req() request: ApiRequest,
  ): Promise<ReviewResult> {
    return this.workshopsService.decline(id, input.reason, requireIdentity(request));
  }

  @Post(':id/execution-proof-override')
  overrideExecutionProof(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(proofOverrideSchema)) input: ProofOverrideInput,
    @Req() request: ApiRequest,
  ) {
    return this.workshopsService.overrideExecutionProof(id, input.reason, requireIdentity(request));
  }

  private streamDownload(
    response: ApiResponse,
    file: { mimeType: string; originalFilename: string; stream: NodeJS.ReadableStream },
  ): void {
    const fallback = file.originalFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(file.originalFilename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    file.stream.on('error', () => response.destroy());
    file.stream.pipe(response.status(200));
  }
}
