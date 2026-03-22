/**
 * Error hierarchy for the Grip/PayClaw SDK.
 * Ported from @payclaw/sdk with additions for Grip-specific errors.
 */

/** Base error class for all SDK errors. */
export class PayClawError extends Error {
  public readonly code: string;
  public readonly statusCode: number | undefined;
  public readonly details: unknown;

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "PayClawError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the API key or agent ID is invalid / revoked. */
export class PayClawAuthError extends PayClawError {
  constructor(message = "Authentication failed — check your API key and agent ID.") {
    super(message, "auth_error", 401);
    this.name = "PayClawAuthError";
  }
}

/** Thrown when a payment is rejected by limit checks or human review. */
export class PayClawPaymentError extends PayClawError {
  public readonly transactionId: string | undefined;

  constructor(message: string, code: string, transactionId?: string) {
    super(message, code, 422);
    this.name = "PayClawPaymentError";
    this.transactionId = transactionId;
  }
}

/** Thrown when the client-side rate limiter blocks a request. */
export class PayClawRateLimitError extends PayClawError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited — retry after ${retryAfterMs}ms`, "rate_limited", 429);
    this.name = "PayClawRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when a request exceeds the configured timeout. */
export class PayClawTimeoutError extends PayClawError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, "timeout");
    this.name = "PayClawTimeoutError";
  }
}

/** Thrown when the API returns a validation error (400). */
export class PayClawValidationError extends PayClawError {
  constructor(message: string) {
    super(message, "validation_error", 400);
    this.name = "PayClawValidationError";
  }
}

/** Thrown when an agent is not found. */
export class AgentNotFoundError extends PayClawError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" not found`, "agent_not_found", 404);
    this.name = "AgentNotFoundError";
  }
}

/** Thrown when funds are insufficient. */
export class InsufficientFundsError extends PayClawError {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds: need ${required} USDC, have ${available} USDC`,
      "insufficient_funds",
      402,
      { required, available }
    );
    this.name = "InsufficientFundsError";
  }
}
