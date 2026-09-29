import { type ApiRequest } from '../common/http/request-response.types.js';

export const trackingSessionCookie = 'tracking_session';

export function readTrackingSessionToken(request: ApiRequest): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${trackingSessionCookie}=`))
    ?.slice(trackingSessionCookie.length + 1);
}
