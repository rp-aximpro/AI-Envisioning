import axios, { type AxiosRequestConfig } from 'axios';

const environment = import.meta.env as unknown as { VITE_API_BASE_URL?: string };

export const apiBaseUrl = environment.VITE_API_BASE_URL ?? 'http://localhost:4000';

const client = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export function apiUrl(path: string): string {
  return new URL(path, `${apiBaseUrl}/`).toString();
}

export async function apiRequest<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    return (await client.request<T>({ ...config, url: path })).data;
  } catch (error) {
    if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
      throw new Error(error.response?.data.error?.message ?? 'Something went wrong. Please try again.');
    }
    throw error;
  }
}
