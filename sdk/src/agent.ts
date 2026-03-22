import { HttpClient } from "./http.js";
import type {
  AgentInfo,
  SessionKeyConfig,
  SessionKeyResult,
  PayOptions,
  PayResult,
  EscrowOptions,
  EscrowResult,
  EscrowInfo,
  ReleaseResult,
  Balance,
  Payment,
  HistoryFilters,
  HistoryResponse,
  PixDepositResult,
  PixWithdrawResult,
  BalanceResponse,
  CanPayResponse,
  LimitsResponse,
} from "./types.js";

/**
 * GripAgent — scoped interface for a single agent.
 * All methods are pre-bound to the agent's ID.
 *
 * @example
 * const agent = payclaw.agent('my-agent')
 * await agent.pay('OpenAI', 20.00, { memo: 'GPT-4 credits' })
 * await agent.escrow('0xpayee...', 5.00, { serviceId: 'translation' })
 */
export class GripAgent {
  constructor(
    private http: HttpClient,
    private agentId: string
  ) {}

  // ─── Identity ──────────────────────────────────────────────────────────────

  /** Get agent details + on-chain reputation. */
  async info(): Promise<AgentInfo> {
    return this.http.get<AgentInfo>(`/agents/${this.agentId}`);
  }

  /** Register agent DID on Grip Protocol (Base). Only needed once. */
  async registerOnChain(walletAddress: string): Promise<{ txHash: string; agentAddress: string }> {
    return this.http.post(`/agents/${this.agentId}/register-on-chain`, { walletAddress });
  }

  /** Issue a scoped session key for this agent. */
  async issueSessionKey(config: SessionKeyConfig): Promise<SessionKeyResult> {
    return this.http.post(`/session-keys/grant`, {
      agentAddress: this.agentId,
      validUntil: Math.floor(Date.now() / 1000) + config.validForHours * 3600,
      allowedContracts: config.allowedContracts ?? [],
      dailySpendingLimitUsdc: config.dailyLimitUsdc,
      perTxLimitUsdc: config.perTxLimitUsdc,
      escalationThresholdUsdc: config.escalationUsdc,
    });
  }

  /** Revoke a session key. */
  async revokeSessionKey(keyId: string): Promise<{ txHash: string }> {
    return this.http.post(`/session-keys/revoke`, {
      agentAddress: this.agentId,
      keyId,
    });
  }

  // ─── Direct Payments (PayClawVault) ────────────────────────────────────────

  /**
   * Direct payment from this agent to a destination.
   *
   * @example
   * await agent.pay('OpenAI', 20.00, { memo: 'GPT-4 API credits' })
   */
  async pay(to: string, amountUsdc: number, options?: PayOptions): Promise<PayResult> {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return this.http.post<PayResult>("/pay", {
      to,
      amount: amountUsdc,
      memo: options?.memo ?? "",
      nonce,
    });
  }

  /** Check if a payment of this amount is allowed. */
  async canPay(amount: number): Promise<CanPayResponse> {
    return this.http.get<CanPayResponse>(`/can-pay?amount=${amount}`);
  }

  /** Get spending limits. */
  async limits(): Promise<LimitsResponse> {
    return this.http.get<LimitsResponse>("/limits");
  }

  // ─── Escrow Payments (ServiceEscrow) ───────────────────────────────────────

  /**
   * Create a trustless escrow. Funds held until delivery confirmed.
   *
   * @example
   * const escrow = await agent.escrow('0xpayee...', 5.00, {
   *   serviceId: 'translation-v1',
   *   timeoutSeconds: 600,
   * })
   */
  async escrow(
    payeeAddress: string,
    amountUsdc: number,
    options?: EscrowOptions
  ): Promise<EscrowResult> {
    return this.http.post<EscrowResult>("/escrow", {
      payeeAddress,
      amountUsdc,
      serviceId: options?.serviceId ?? `escrow-${Date.now()}`,
      commitHash: options?.commitHash,
      timeoutSeconds: options?.timeoutSeconds ?? 300,
      memo: options?.memo,
    });
  }

  /** Release escrow — confirms delivery and pays the payee. */
  async release(escrowId: string): Promise<ReleaseResult> {
    return this.http.post<ReleaseResult>("/escrow/release", { escrowId });
  }

  /** Refund an expired escrow back to payer. */
  async refund(escrowId: string): Promise<{ escrowId: string; txHash: string; status: string }> {
    return this.http.post("/escrow/refund", { escrowId });
  }

  /** Dispute an escrow. */
  async dispute(escrowId: string): Promise<{ escrowId: string; txHash: string; status: string }> {
    return this.http.post("/escrow/dispute", { escrowId });
  }

  /** Get escrow details by ID. */
  async getEscrow(escrowId: string): Promise<EscrowInfo> {
    return this.http.get<EscrowInfo>(`/escrow/${escrowId}`);
  }

  // ─── Balance & History ─────────────────────────────────────────────────────

  /** Get unified USDC balance (vault balance - pending). */
  async balance(): Promise<BalanceResponse> {
    return this.http.get<BalanceResponse>("/balance");
  }

  /** Payment history for this agent. */
  async history(filters?: HistoryFilters): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.cursor) params.set("cursor", filters.cursor);
    const qs = params.toString();
    return this.http.get<HistoryResponse>(`/history${qs ? `?${qs}` : ""}`);
  }

  // ─── Pix ───────────────────────────────────────────────────────────────────

  /** Generate a Pix QR code to fund agent wallet (BRL → USDC). */
  async pixDeposit(amountBrl: number): Promise<PixDepositResult> {
    return this.http.post<PixDepositResult>("/pix/deposit", {
      amountBrl,
    });
  }

  /** Withdraw from agent wallet via Pix (USDC → BRL). */
  async pixWithdraw(amountBrl: number, pixKey: string): Promise<PixWithdrawResult> {
    return this.http.post<PixWithdrawResult>("/pix/withdraw", {
      amountBrl,
      pixKey,
    });
  }
}
