import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import { type CookieResponse } from '../common/http/cookie-response.types.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { getEnv, isProductionLikeEnvironment } from '../infrastructure/env.js';
import { AdminAuthService } from './admin-auth.service.js';
import { adminSessionCookie, readAdminSessionToken } from './admin-session-cookie.js';

@Injectable()
export class RequireAdminGuard implements CanActivate {
  constructor(@Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const response = context.switchToHttp().getResponse<CookieResponse>();
    const token = readAdminSessionToken(request);
    const session = await this.adminAuthService.getSession(token);
    if (!token || !session) throw AppError.unauthorized();

    request.adminIdentity = session.identity;
    response.cookie(adminSessionCookie, token, this.cookieOptions(session.maxAgeMs));
    return true;
  }

  private cookieOptions(maxAge: number) {
    const env = getEnv();
    return {
      httpOnly: true,
      maxAge,
      path: '/api/admin',
      sameSite: isProductionLikeEnvironment(env.NODE_ENV) ? 'none' as const : 'lax' as const,
      secure: isProductionLikeEnvironment(env.NODE_ENV),
    };
  }
}
