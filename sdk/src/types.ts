/**
 * Unified types — merge of @payclaw/sdk + @grip-protocol/sdk types.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

export interface PayClawConfig {
  /** API key issued by PayClaw (starts with `payclaw_`). */
  apiKey: string;
  /** Default agent identifier. */
  agentId: string;
  /** Base URL of the PayClaw API. Defaults to `https://api.payclaw.me/v1`. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to `10_000`. */
  timeoutMs?: number;
  /** Called when a payment requires human approval. */
  onApprovalNeeded?: (tx: PayResult) => Promise<void>;
}

export interface AgentConfig {
  name: string;
  modelVersion?: string;
  capabilities?: string[];
  walletAddress?: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "pending_approval" | "rejected" | "failed" | "confirmed" | "pending";

export interface PayOptions {
  memo?: string;
}

export interface PayResult {
  id: string;
  status: PaymentStatus;
  txHash?: string;
  receipt?: string;
  amountUsdc: number;
  fee?: number;
  to: string;
  balance?: number;
}

// ─── Escrow ──────────────────────────────────────────────────────────────────

export interface EscrowOptions {
  serviceId?: string;
  commitHash?: string;
  timeoutSeconds?: number;
  memo?: string;
}

export interface EscrowResult {
  paymentId: string;
  escrowId: string;
  txHash: string;
  status: "confirmed" | "pending";
  amountUsdc: number;
  payeeAddress: string;
  timeoutSeconds: number;
  fee: number;
}

export interface ReleaseResult {
  escrowId: string;
  txHash: string;
  status: "released";
}

export interface EscrowInfo {
  escrowId: string;
  payer: string;
  payee: string;
  amountUsdc: string;
  serviceId: string;
  status: "created" | "released" | "refunded" | "disputed";
  timeout: number;
  createdAt: number;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  available: number;
  currency: "USDC";
  pending: number;
}

export interface Balance {
  usdc: number;
  address: string | null;
}

// ─── Limits & CanPay ─────────────────────────────────────────────────────────

export interface LimitsResponse {
  perTx: number;
  daily: number;
  monthly: number;
  used: { daily: number; monthly: number };
}

export type CanPayReason =
  | "exceeds_per_tx_limit"
  | "exceeds_daily_limit"
  | "exceeds_monthly_limit"
  | "insufficient_balance"
  | "destination_not_whitelisted";

export type CanPayResponse =
  | { allowed: true; reason: null }
  | { allowed: false; reason: CanPayReason };

// ─── Destinations ────────────────────────────────────────────────────────────

export type DestinationType = "merchant" | "individual" | "platform";
export type DestinationStatus = "whitelisted" | "pending" | "blocked";

export interface Destination {
  id: string;
  name: string;
  type: DestinationType;
  status: DestinationStatus;
}

export interface DestinationRequestResult {
  id: string;
  status: "pending_human_approval";
}

export interface DestinationRequestDetails {
  website?: string;
  reason?: string;
  [key: string]: unknown;
}

// ─── Top-up ──────────────────────────────────────────────────────────────────

export type TopupMethod = "crypto" | "bank_transfer" | "card";

export interface TopupResult {
  id: string;
  status: "pending" | "completed";
  instructions: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryFilters {
  status?: PaymentStatus;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface Payment {
  id: string;
  type: "direct" | "escrow";
  direction: "outbound" | "inbound";
  status: string;
  amountUsdc: number;
  feeUsdc: number;
  toAddress: string | null;
  fromAddress: string | null;
  memo: string | null;
  escrowId: string | null;
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface HistoryResponse {
  transactions: Payment[];
  cursor: string | null;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  agentId: string;
  name: string;
  modelVersion: string;
  walletAddress: string | null;
  onChain: boolean;
  onChainTx: string | null;
  createdAt: string;
  onChainInfo?: {
    reputationScore: number;
    totalTxs: number;
    successRate: number;
    skillset: string[];
  } | null;
}

// ─── Session Keys ────────────────────────────────────────────────────────────

export interface SessionKeyConfig {
  dailyLimitUsdc: number;
  perTxLimitUsdc: number;
  escalationUsdc: number;
  validForHours: number;
  allowedContracts?: string[];
}

export interface SessionKeyResult {
  keyId: string;
  txHash: string;
}

// ─── Pix ─────────────────────────────────────────────────────────────────────

export interface PixDepositResult {
  pixId: string;
  qrCode: string;
  qrCodeImage: string;
  amountBrl: number;
  amountUsdc: number;
  rateBrlUsdc: number;
  expiresAt: string;
}

export interface PixWithdrawResult {
  pixId: string;
  e2eId: string;
  amountBrl: number;
  amountUsdc: number;
  status: "pending";
  estimatedMinutes: number;
}

export interface PixRate {
  rateBrlUsdc: number;
  currency: string;
}

// ─── Internal ────────────────────────────────────────────────────────────────

/** @internal */
export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
  code?: string;
}
