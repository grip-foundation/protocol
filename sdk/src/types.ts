// ─── Config ──────────────────────────────────────────────────────────────────

export interface PayClawConfig {
  apiKey: string;
  agentId: string;
  baseUrl?: string;       // default: https://api.payclaw.me
  timeout?: number;       // ms, default: 30000
  onError?: (err: PayClawError) => void;
}

export interface AgentConfig {
  name: string;
  modelVersion?: string;
  capabilities?: string[];
  walletAddress?: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface PayOptions {
  memo?: string;
}

export interface EscrowOptions {
  serviceId?: string;
  commitHash?: string;
  timeoutSeconds?: number;
  memo?: string;
}

export interface PayResult {
  id: string;
  status: 'confirmed' | 'pending' | 'failed';
  txHash: string;
  amountUsdc: number;
  fee: number;
  to: string;
  timestamp: string;
}

export interface EscrowResult {
  id: string;
  escrowId: number;
  txHash: string;
  status: 'confirmed' | 'pending';
  amountUsdc: number;
  payeeAddress: string;
  timeoutSeconds: number;
}

export interface ReleaseResult {
  escrowId: number;
  txHash: string;
  status: 'released';
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
    reputationScore: bigint;
    totalTxs: bigint;
    successRate: bigint;
  } | null;
}

// ─── Session Keys ─────────────────────────────────────────────────────────────

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
  status: 'pending';
  estimatedMinutes: number;
}

export interface PixRate {
  brl_per_usdc: number;
  usdc_per_brl: number;
  source: string;
  timestamp: string;
}

// ─── Balance & History ───────────────────────────────────────────────────────

export interface Balance {
  usdc: number;
  address: string | null;
}

export interface Payment {
  id: string;
  type: 'direct' | 'escrow';
  direction: 'outbound' | 'inbound';
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  amountUsdc: number;
  feeUsdc: number;
  toAddress: string | null;
  fromAddress: string | null;
  memo: string | null;
  escrowId: number | null;
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PayClawError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PayClawError';
  }
}

export class InsufficientFundsError extends PayClawError {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds: need ${required} USDC, have ${available} USDC`,
      'INSUFFICIENT_FUNDS',
      402,
      { required, available },
    );
    this.name = 'InsufficientFundsError';
  }
}

export class AgentNotFoundError extends PayClawError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" not found`, 'AGENT_NOT_FOUND', 404);
    this.name = 'AgentNotFoundError';
  }
}

export class UnauthorizedError extends PayClawError {
  constructor() {
    super('Invalid or missing API key', 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}
