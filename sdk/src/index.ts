// ─── Main exports ───────────────────────────────────────────────────────────

export { PayClaw } from "./payclaw.js";
export { GripAgent } from "./agent.js";

// ─── Errors ─────────────────────────────────────────────────────────────────

export {
  PayClawError,
  PayClawAuthError,
  PayClawPaymentError,
  PayClawRateLimitError,
  PayClawTimeoutError,
  PayClawValidationError,
  AgentNotFoundError,
  InsufficientFundsError,
} from "./errors.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type {
  // Config
  PayClawConfig,
  AgentConfig,

  // Payments
  PaymentStatus,
  PayOptions,
  PayResult,

  // Escrow
  EscrowOptions,
  EscrowResult,
  EscrowInfo,
  ReleaseResult,

  // Balance
  BalanceResponse,
  Balance,

  // Limits & CanPay
  LimitsResponse,
  CanPayReason,
  CanPayResponse,

  // Destinations
  DestinationType,
  DestinationStatus,
  Destination,
  DestinationRequestResult,
  DestinationRequestDetails,

  // Top-up
  TopupMethod,
  TopupResult,

  // History
  HistoryFilters,
  HistoryResponse,
  Payment,

  // Agents
  AgentInfo,

  // Session Keys
  SessionKeyConfig,
  SessionKeyResult,

  // Pix
  PixDepositResult,
  PixWithdrawResult,
  PixRate,
} from "./types.js";
