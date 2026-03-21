import { HttpClient } from './http';
import { GripAgent } from './agent';
import type {
  PayClawConfig,
  AgentConfig,
  AgentInfo,
  Payment,
  PixRate,
  PayOptions,
  PayResult,
  EscrowOptions,
  EscrowResult,
} from './types';

/**
 * PayClaw — Payment infrastructure for AI agents.
 * Built on Grip Protocol (Base L2).
 *
 * @example
 * // 3-line setup
 * import { PayClaw } from '@grip-protocol/sdk'
 *
 * const payclaw = new PayClaw({
 *   apiKey: process.env.PAYCLAW_KEY,
 *   agentId: 'my-agent',
 * })
 *
 * await payclaw.pay('OpenAI', 20.00, 'GPT-4 API credits')
 * // → { status: 'confirmed', txHash: '0x...', balance: 460.00 }
 */
export class PayClaw {
  private http: HttpClient;
  private config: PayClawConfig;
  private _defaultAgent: GripAgent;

  constructor(config: PayClawConfig) {
    if (!config.apiKey) throw new Error('PayClaw: apiKey is required');
    if (!config.agentId) throw new Error('PayClaw: agentId is required');

    this.config = config;
    this.http = new HttpClient(
      config.apiKey,
      config.baseUrl ?? 'https://api.payclaw.me',
      config.timeout ?? 30_000,
    );
    this._defaultAgent = new GripAgent(this.http, config.agentId);
  }

  // ─── The 3-line API ──────────────────────────────────────────────────────

  /**
   * Pay from the default agent to any address or alias.
   *
   * @example
   * await payclaw.pay('OpenAI', 20.00, 'GPT-4 API credits')
   * await payclaw.pay('0xabc...', 0.02, 'transcription job')
   */
  async pay(to: string, amountUsdc: number, memo?: string): Promise<PayResult & { balance: number }> {
    const result = await this._defaultAgent.pay(to, amountUsdc, { memo });
    const balance = await this._defaultAgent.balance();
    return { ...result, balance: balance.usdc };
  }

  /**
   * Create trustless escrow. Funds released when you call release().
   *
   * @example
   * const escrow = await payclaw.escrow('0xpayee...', 0.05)
   * // ... payee does work ...
   * await payclaw.release(escrow.escrowId)
   */
  async escrow(payeeAddress: string, amountUsdc: number, options?: EscrowOptions): Promise<EscrowResult> {
    return this._defaultAgent.escrow(payeeAddress, amountUsdc, options);
  }

  /**
   * Release an escrow — confirms delivery and pays the payee.
   */
  async release(escrowId: number) {
    return this._defaultAgent.release(escrowId);
  }

  /**
   * Get USDC balance for the default agent.
   */
  async balance(): Promise<number> {
    const b = await this._defaultAgent.balance();
    return b.usdc;
  }

  // ─── Fluent agent interface ───────────────────────────────────────────────

  /**
   * Get a scoped interface for a specific agent.
   * All methods are pre-bound to that agent's ID.
   *
   * @example
   * const researcher = payclaw.agent('researcher-agent')
   * await researcher.pay('0xdataset...', 5.00)
   * await researcher.pixDeposit(100) // fund with R$100
   */
  agent(agentId: string): GripAgent {
    return new GripAgent(this.http, agentId);
  }

  // ─── Agent management ────────────────────────────────────────────────────

  /**
   * Create a new agent.
   */
  async createAgent(config: AgentConfig & { agentId: string }): Promise<AgentInfo> {
    return this.http.post<AgentInfo>('/agents', {
      agentId: config.agentId,
      name: config.name,
      modelVersion: config.modelVersion ?? 'unknown',
      capabilities: config.capabilities ?? [],
      walletAddress: config.walletAddress,
    });
  }

  /**
   * List all agents for this API key.
   */
  async agents(): Promise<AgentInfo[]> {
    return this.http.get<AgentInfo[]>('/agents');
  }

  // ─── Pix ─────────────────────────────────────────────────────────────────

  /**
   * Generate a Pix QR code to fund the default agent wallet.
   * BRL → USDC conversion via GlobalPix.
   *
   * @example
   * const { qrCode, amountUsdc } = await payclaw.pixDeposit(100) // R$100
   */
  async pixDeposit(amountBrl: number) {
    return this._defaultAgent.pixDeposit(amountBrl);
  }

  /**
   * Withdraw from agent wallet to a Pix key.
   * USDC → BRL conversion.
   */
  async pixWithdraw(amountBrl: number, pixKey: string) {
    return this._defaultAgent.pixWithdraw(amountBrl, pixKey);
  }

  /**
   * Get current BRL/USDC exchange rate.
   */
  async pixRate(): Promise<PixRate> {
    return this.http.get<PixRate>('/pix/rate');
  }

  // ─── History ─────────────────────────────────────────────────────────────

  /**
   * Payment history across all agents.
   */
  async history(): Promise<Payment[]> {
    return this.http.get<Payment[]>('/payments/history');
  }
}
