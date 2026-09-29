import { type IncomingMessage, type ServerResponse } from 'node:http';

export interface ApiRequest extends IncomingMessage {
  originalUrl: string;
  requestId?: string;
  adminIdentity?: { adminId: string; displayName: string; email: string };
  header(name: string): string | undefined;
}

export interface ApiResponse extends ServerResponse {
  json(body: unknown): void;
  status(statusCode: number): ApiResponse;
}
