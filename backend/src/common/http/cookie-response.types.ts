import { type ApiResponse } from './request-response.types.js';

export interface CookieOptions {
  httpOnly: boolean;
  maxAge?: number;
  path: string;
  sameSite: 'lax' | 'none';
  secure: boolean;
}

export interface CookieResponse extends ApiResponse {
  clearCookie(name: string, options: CookieOptions): CookieResponse;
  cookie(name: string, value: string, options: CookieOptions): CookieResponse;
}
