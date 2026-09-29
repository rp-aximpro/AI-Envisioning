import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { type CookieResponse } from '../common/http/cookie-response.types.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { getEnv, isProductionLikeEnvironment } from '../infrastructure/env.js';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service.js';
import { adminSessionCookie, readAdminSessionToken } from './admin-session-cookie.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

type LoginInput = z.infer<typeof loginSchema>;

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AdminIdentity> {
    const session = await this.adminAuthService.login(input.email, input.password);
    response.cookie(adminSessionCookie, session.token, this.cookieOptions(session.maxAgeMs));
    return session.identity;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) response: CookieResponse): Promise<void> {
    await this.adminAuthService.logout(readAdminSessionToken(request));
    response.clearCookie(adminSessionCookie, this.cookieOptions());
  }

  @Get('session')
  async getSession(
    @Req() request: ApiRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AdminIdentity> {
    const token = readAdminSessionToken(request);
    const session = await this.adminAuthService.getSession(token);
    if (!session || !token) throw AppError.unauthorized();
    response.cookie(adminSessionCookie, token, this.cookieOptions(session.maxAgeMs));
    return session.identity;
  }

  private cookieOptions(maxAge?: number) {
    const env = getEnv();
    const options = {
      httpOnly: true,
      path: '/api/admin',
      sameSite: isProductionLikeEnvironment(env.NODE_ENV) ? 'none' as const : 'lax' as const,
      secure: isProductionLikeEnvironment(env.NODE_ENV),
    };
    return maxAge === undefined ? options : { ...options, maxAge };
  }
}
