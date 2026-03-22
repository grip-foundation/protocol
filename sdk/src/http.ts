/**
 * HTTP client with HMAC auth and client-side rate limiting.
 * Merges the best of both SDKs:
 * - @payclaw/sdk: HMAC signatures, RateLimiter, error hierarchy, timeout
 * - @grip-protocol/sdk: clean get/post/delete interface
 */

import { createHmac, randomBytes } from "node:crypto";
import {
  PayClawError,
  PayClawAuthError,
  PayClawPaymentError,
  PayClawRateLimitError,
  PayClawTimeoutError,
  PayClawValidationError,
} from "./errors.js";
import type { ApiResponse } from "./types.js";

// ─── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter {
  private readonly maxPerSecond: number;
  private timestamps: number[] = [];

  constructor(maxPerSecond = 10) {
    this.maxPerSecond = maxPerSecond;
  }

  check(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 1000);
    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0]!;
      throw new PayClawRateLimitError(1000 - (now - oldest));
    }
    this.timestamps.push(now);
  }
}

// ─── HTTP Client ────────────────────────────────────────────────────────────

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly agentId: string;
  private readonly timeoutMs: number;
  private readonly rateLimiter: RateLimiter;

  constructor(apiKey: string, agentId: string, baseUrl: string, timeoutMs: number) {
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
    this.rateLimiter = new RateLimiter(10);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    this.rateLimiter.check();

    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(8).toString("hex");
    const payload = body ? JSON.stringify(body) : "";

    // HMAC signature: HMAC-SHA256(apiKey, timestamp.nonce.method.path.body)
    const signatureInput = `${timestamp}.${nonce}.${method}.${path}.${payload}`;
    const signature = createHmac("sha256", this.apiKey)
      .update(signatureInput)
      .digest("hex");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-PayClaw-Agent": this.agentId,
      "X-PayClaw-Timestamp": timestamp,
      "X-PayClaw-Nonce": nonce,
      "X-PayClaw-Signature": signature,
      "User-Agent": "@grip-protocol/sdk/0.2.0",
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: method !== "GET" ? payload || undefined : undefined,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new PayClawTimeoutError(this.timeoutMs);
      }
      throw new PayClawError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        "network_error"
      );
    } finally {
      clearTimeout(timer);
    }

    // Parse response
    let json: ApiResponse<T>;
    try {
      json = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new PayClawError(
        `Invalid JSON response (HTTP ${response.status})`,
        "parse_error",
        response.status
      );
    }

    // Handle errors
    if (!response.ok || !json.ok) {
      const msg = json.error ?? `API error (HTTP ${response.status})`;
      const code = json.code ?? "api_error";

      if (response.status === 401) throw new PayClawAuthError(msg);
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        throw new PayClawRateLimitError(retryAfter * 1000);
      }
      if (response.status === 400) throw new PayClawValidationError(msg);
      if (response.status === 422) throw new PayClawPaymentError(msg, code);
      throw new PayClawError(msg, code, response.status);
    }

    return json.data;
  }
}
