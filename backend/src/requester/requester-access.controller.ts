import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { type CookieResponse } from '../common/http/cookie-response.types.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { getEnv } from '../infrastructure/env.js';
import { RequesterAccessService } from './requester-access.service.js';
import { readRequesterSessionToken, requesterSessionCookie } from './requester-session-cookie.js';
const sendOtpSchema = z.object({ email: z.string().trim().email().max(320) });
const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits.'),
  email: z.string().trim().email().max(320),
});

type SendOtpInput = z.infer<typeof sendOtpSchema>;
type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

@Controller()
export class RequesterAccessController {
  constructor(
    @Inject(RequesterAccessService) private readonly requesterAccessService: RequesterAccessService,
  ) {}

  @Post('api/public/request-access/send-otp')
  @HttpCode(202)
  async sendOtp(
    @Body(new ZodValidationPipe(sendOtpSchema)) input: SendOtpInput,
    @Req() request: ApiRequest,
  ): Promise<{ message: string }> {
    await this.requesterAccessService.sendOtp(input.email, request.socket.remoteAddress);
    return { message: 'If the email is eligible, a verification code has been sent.' };
  }

  @Post('api/public/request-access/verify-otp')
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) input: VerifyOtpInput,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<{ email: string; domain: string }> {
    const token = await this.requesterAccessService.verifyOtp(input.email, input.code);
    response.cookie(requesterSessionCookie, token, this.cookieOptions());

    return {
      domain: input.email.trim().toLowerCase().split('@').at(-1) ?? '',
      email: input.email.trim().toLowerCase(),
    };
  }

  @Post('api/public/request-access/logout')
  @HttpCode(204)
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) response: CookieResponse): Promise<void> {
    await this.requesterAccessService.logout(readRequesterSessionToken(request));
    response.clearCookie(requesterSessionCookie, this.cookieOptions(false));
  }

  @Get('api/requester/session')
  async getSession(@Req() request: ApiRequest): Promise<{ email: string; domain: string }> {
    const session = await this.requesterAccessService.getSession(readRequesterSessionToken(request));
    if (!session) {
      throw AppError.unauthorized();
    }
    return session;
  }

  private cookieOptions(includeMaxAge = true) {
    const env = getEnv();
    const options = {
      httpOnly: true,
      path: '/',
      sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
      secure: env.NODE_ENV === 'production',
    };
    return includeMaxAge ? { ...options, maxAge: env.REQUESTER_SESSION_TTL_MINUTES * 60_000 } : options;
  }
}
