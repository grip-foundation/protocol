import { HttpClient } from './http';
import type {
  AgentInfo,
  AgentConfig,
  SessionKeyConfig,
  SessionKeyResult,
  PayOptions,
  PayResult,
  EscrowOptions,
  EscrowResult,
  ReleaseResult,
  Balance,
  Payment,
  PixDepositResult,
  PixWithdrawResult,
} from './types';

/**
 * GripAgent — scoped interface for a single agent.
 * All methods are pre-bound to the agent's ID.
 *
 * @example
 * const agent = payclaw.agent('my-agent')
 * await agent.pay('0xabc...', 0.02, { memo: 'transcription' })
 */
export class GripAgent {
  constructor(
    private http: HttpClient,
    private agentId: string,
  ) {}

  // ─── Identity ────────────────────────────────────────────────────────────

  /**
   * Get agent details + on-chain reputation.
   */
  async info(): Promise<AgentInfo> {
    return this.http.get<AgentInfo>(`/agents/${this.agentId}`);
  }

  /**
   * Register agent DID on Grip Protocol (Base).
   * Only needed once. Requires a wallet address.
   */
  async registerOnChain(walletAddress: string): Promise<{ txHash: string; agentAddress: string }> {
    return this.http.post(`/agents/${this.agentId}/register-on-chain`, { walletAddress });
  }

  /**
   * Issue a scoped session key for this agent.
   * Controls spending limits, time bounds, and allowed contracts.
   */
  async issueSessionKey(config: SessionKeyConfig): Promise<SessionKeyResult> {
    return this.http.post(`/agents/${this.agentId}/session-keys`, config);
  }

  // ─── Payments ────────────────────────────────────────────────────────────

  /**
   * Direct payment from this agent to an address.
   *
   * @example
   * await agent.pay('OpenAI', 20.00, { memo: 'GPT-4 API credits' })
   * await agent.pay('0xabc...', 0.02, { memo: 'transcription job' })
   */
  async pay(to: string, amountUsdc: number, options?: PayOptions): Promise<PayResult> {
    return this.http.post<PayResult>('/payments/pay', {
      agentId: this.agentId,
      to,
      amountUsdc,
      memo: options?.memo,
    });
  }

  /**
   * Create a trustless escrow payment. Funds held until delivery confirmed.
   *
   * @example
   * const escrow = await agent.escrow('0xpayee...', 0.05, {
   *   serviceId: 'translation-v1',
   *   timeoutSeconds: 300,
   * })
   */
  async escrow(payeeAddress: string, amountUsdc: number, options?: EscrowOptions): Promise<EscrowResult> {
    return this.http.post<EscrowResult>('/payments/escrow', {
      agentId: this.agentId,
      payeeAddress,
      amountUsdc,
      serviceId: options?.serviceId ?? `escrow-${Date.now()}`,
      commitHash: options?.commitHash,
      timeoutSeconds: options?.timeoutSeconds ?? 300,
      memo: options?.memo,
    });
  }

  /**
   * Release escrow to payee — confirms service was delivered.
   */
  async release(escrowId: number): Promise<ReleaseResult> {
    return this.http.post<ReleaseResult>(`/payments/escrow/${escrowId}/release`);
  }

  /**
   * Refund an expired escrow back to payer.
   */
  async refund(escrowId: number): Promise<{ escrowId: number; txHash: string; status: string }> {
    return this.http.post(`/payments/escrow/${escrowId}/refund`);
  }

  // ─── Balance & History ───────────────────────────────────────────────────

  /**
   * Get USDC balance for this agent's wallet.
   */
  async balance(): Promise<Balance> {
    return this.http.get<Balance>(`/payments/balance/${this.agentId}`);
  }

  /**
   * Payment history for this agent.
   */
  async history(): Promise<Payment[]> {
    return this.http.get<Payment[]>(`/payments/history?agentId=${this.agentId}`);
  }

  // ─── Pix ─────────────────────────────────────────────────────────────────

  /**
   * Generate a Pix QR code to fund agent wallet (BRL → USDC).
   */
  async pixDeposit(amountBrl: number): Promise<PixDepositResult> {
    return this.http.post<PixDepositResult>('/pix/deposit', {
      agentId: this.agentId,
      amountBrl,
    });
  }

  /**
   * Withdraw from agent wallet via Pix (USDC → BRL).
   */
  async pixWithdraw(amountBrl: number, pixKey: string): Promise<PixWithdrawResult> {
    return this.http.post<PixWithdrawResult>('/pix/withdraw', {
      agentId: this.agentId,
      amountBrl,
      pixKey,
    });
  }
}
