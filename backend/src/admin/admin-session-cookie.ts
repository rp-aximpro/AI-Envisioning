import { type ApiRequest } from '../common/http/request-response.types.js';

export const adminSessionCookie = 'admin_session';

export function readAdminSessionToken(request: ApiRequest): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${adminSessionCookie}=`))
    ?.slice(adminSessionCookie.length + 1);
}
