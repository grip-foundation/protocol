import { PayClawError, UnauthorizedError } from './types';

const DEFAULT_BASE_URL = 'https://api.payclaw.me';
const DEFAULT_TIMEOUT = 30_000;

export class HttpClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(apiKey: string, baseUrl = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'x-sdk-version': '0.1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) throw new UnauthorizedError();
        throw new PayClawError(
          data?.message ?? `Request failed: ${res.status}`,
          data?.code ?? 'REQUEST_FAILED',
          res.status,
          data,
        );
      }

      return data as T;
    } catch (err) {
      if (err instanceof PayClawError) throw err;
      if ((err as any)?.name === 'AbortError') {
        throw new PayClawError('Request timed out', 'TIMEOUT', 408);
      }
      throw new PayClawError(
        (err as Error).message ?? 'Network error',
        'NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
