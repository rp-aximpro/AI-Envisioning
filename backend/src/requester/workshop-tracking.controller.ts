import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';

import { type CookieResponse } from '../common/http/cookie-response.types.js';
import { type ApiRequest, type ApiResponse } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { getEnv, isProductionLikeEnvironment } from '../infrastructure/env.js';
import { readTrackingSessionToken, trackingSessionCookie } from './tracking-session-cookie.js';
import { TrackingSessionService } from './tracking-session.service.js';
import { WorkshopExecutionService, type UploadedProofFile } from './workshop-execution.service.js';
import { type WorkshopTrackingDetails, WorkshopTrackingService } from './workshop-tracking.service.js';
import { RequireTrackingWorkshopGuard } from './require-tracking-workshop.guard.js';

const sendOtpSchema = z.object({ email: z.string().trim().email().max(320) });
const verifyOtpSchema = sendOtpSchema.extend({ code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits.') });
const fileIdSchema = z.string().uuid();
const executionSchema = z.object({
  actualAttendees: z.string().regex(/^\d{1,6}$/).transform(Number),
  notes: z.string().trim().max(10_000).optional().default(''),
});

type SendOtpInput = z.infer<typeof sendOtpSchema>;
type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
type ExecutionInput = z.infer<typeof executionSchema>;

@Controller()
export class WorkshopTrackingController {
  constructor(
    @Inject(WorkshopTrackingService) private readonly trackingService: WorkshopTrackingService,
    @Inject(TrackingSessionService) private readonly trackingSessionService: TrackingSessionService,
    @Inject(WorkshopExecutionService) private readonly executionService: WorkshopExecutionService,
  ) {}

  @Post('api/public/workshops/:trackingToken/send-otp')
  @HttpCode(202)
  async sendOtp(
    @Param('trackingToken') trackingToken: string,
    @Body(new ZodValidationPipe(sendOtpSchema)) input: SendOtpInput,
    @Req() request: ApiRequest,
  ): Promise<{ message: string }> {
    await this.trackingService.sendOtp(trackingToken, input.email, request.socket.remoteAddress);
    return { message: 'If the email matches this workshop, a verification code has been sent.' };
  }

  @Post('api/public/workshops/:trackingToken/verify-otp')
  async verifyOtp(
    @Param('trackingToken') trackingToken: string,
    @Body(new ZodValidationPipe(verifyOtpSchema)) input: VerifyOtpInput,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<{ domain: string; email: string }> {
    const token = await this.trackingService.verifyOtp(trackingToken, input.email, input.code);
    response.cookie(trackingSessionCookie, token, this.cookieOptions());
    const email = input.email.trim().toLowerCase();
    return { domain: email.slice(email.lastIndexOf('@') + 1), email };
  }

  @Get('api/tracking/workshops/:trackingToken')
  getWorkshop(
    @Param('trackingToken') trackingToken: string,
    @Req() request: ApiRequest,
  ): Promise<WorkshopTrackingDetails> {
    return this.trackingService.getWorkshop(trackingToken, readTrackingSessionToken(request));
  }

  @Post('api/tracking/workshops/:trackingToken/mark-executed')
  @HttpCode(204)
  async markPlannedComplete(@Param('trackingToken') trackingToken: string, @Req() request: ApiRequest): Promise<void> {
    await this.executionService.markPlannedComplete(trackingToken, readTrackingSessionToken(request));
  }

  @Post('api/tracking/workshops/:trackingToken/mark-executed-complete')
  @HttpCode(204)
  async markExecutedComplete(@Param('trackingToken') trackingToken: string, @Req() request: ApiRequest): Promise<void> {
    await this.executionService.markExecutedComplete(trackingToken, readTrackingSessionToken(request));
  }

  @Post('api/tracking/workshops/:trackingToken/execution')
  @HttpCode(204)
  @UseGuards(RequireTrackingWorkshopGuard)
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: getEnv().MAX_UPLOAD_BYTES, files: 10 } }))
  async submitExecution(
    @Param('trackingToken') trackingToken: string,
    @Req() request: ApiRequest,
    @Body(new ZodValidationPipe(executionSchema)) input: ExecutionInput,
    @UploadedFiles() files: UploadedProofFile[] | undefined,
  ): Promise<void> {
    await this.executionService.submitExecution(trackingToken, readTrackingSessionToken(request), input, files ?? []);
  }

  @Post('api/tracking/workshops/:trackingToken/execution/files')
  @HttpCode(204)
  @UseGuards(RequireTrackingWorkshopGuard)
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: getEnv().MAX_UPLOAD_BYTES, files: 10 } }))
  async addExecutionProofFiles(
    @Param('trackingToken') trackingToken: string,
    @Req() request: ApiRequest,
    @UploadedFiles() files: UploadedProofFile[] | undefined,
  ): Promise<void> {
    await this.executionService.addProofFiles(trackingToken, readTrackingSessionToken(request), files ?? []);
  }

  @Get('api/tracking/workshops/:trackingToken/files/:fileId/download')
  async downloadTrackingFile(
    @Param('trackingToken') trackingToken: string,
    @Param('fileId', new ZodValidationPipe(fileIdSchema)) fileId: string,
    @Req() request: ApiRequest,
    @Res() response: ApiResponse,
  ): Promise<void> {
    const file = await this.executionService.downloadForTracking(trackingToken, readTrackingSessionToken(request), fileId);
    this.writeDownload(response, file);
  }

  @Post('api/tracking/logout')
  @HttpCode(204)
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) response: CookieResponse): Promise<void> {
    await this.trackingSessionService.revoke(readTrackingSessionToken(request));
    response.clearCookie(trackingSessionCookie, this.cookieOptions(false));
  }

  private cookieOptions(includeMaxAge = true) {
    const env = getEnv();
    const options = {
      httpOnly: true,
      path: '/api',
      sameSite: isProductionLikeEnvironment(env.NODE_ENV) ? 'none' as const : 'lax' as const,
      secure: isProductionLikeEnvironment(env.NODE_ENV),
    };
    return includeMaxAge ? { ...options, maxAge: env.TRACKING_SESSION_TTL_MINUTES * 60_000 } : options;
  }

  private writeDownload(response: ApiResponse, file: { mimeType: string; originalFilename: string; stream: NodeJS.ReadableStream }): void {
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
