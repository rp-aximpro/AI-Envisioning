import { type ApiRequest } from '../common/http/request-response.types.js';

export const requesterSessionCookie = 'requester_session';

export function readRequesterSessionToken(request: ApiRequest): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${requesterSessionCookie}=`))
    ?.slice(requesterSessionCookie.length + 1);
}
