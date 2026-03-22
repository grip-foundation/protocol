import { HttpClient } from "./http.js";
import { GripAgent } from "./agent.js";
import { PayClawValidationError } from "./errors.js";
import type {
  PayClawConfig,
  AgentConfig,
  AgentInfo,
  PayResult,
  EscrowOptions,
  EscrowResult,
  ReleaseResult,
  BalanceResponse,
  CanPayResponse,
  LimitsResponse,
  HistoryFilters,
  HistoryResponse,
  Destination,
  DestinationRequestDetails,
  DestinationRequestResult,
  TopupMethod,
  TopupResult,
  PixRate,
  PixDepositResult,
  PixWithdrawResult,
} from "./types.js";

/**
 * PayClaw — unified payment SDK for AI agents.
 * Built on Grip Protocol (Base L2).
 *
 * @example
 * ```ts
 * import { PayClaw } from '@grip-protocol/sdk'
 *
 * const payclaw = new PayClaw({
 *   apiKey: 'payclaw_live_xxx',
 *   agentId: 'my-agent',
 * })
 *
 * // Direct payment (PayClawVault)
 * await payclaw.pay('OpenAI', 20.00, 'GPT-4 credits')
 *
 * // Escrow (ServiceEscrow)
 * const escrow = await payclaw.escrow('0xpayee...', 5.00, { serviceId: 'translation' })
 * await payclaw.release(escrow.escrowId)
 *
 * // Pix on-ramp (BRL → USDC)
 * const { qrCode } = await payclaw.pixDeposit(500)
 *
 * // Multi-agent
 * const researcher = payclaw.agent('researcher')
 * await researcher.pay('Dataset API', 10.00, { memo: 'training data' })
 * ```
 */
export class PayClaw {
  private http: HttpClient;
  private config: PayClawConfig;
  private _defaultAgent: GripAgent;

  constructor(config: PayClawConfig) {
    if (!config.apiKey || !config.apiKey.startsWith("payclaw_")) {
      throw new PayClawValidationError("Invalid API key — must start with 'payclaw_'.");
    }
    if (!config.agentId) {
      throw new PayClawValidationError("agentId is required.");
    }

    this.config = config;
    this.http = new HttpClient(
      config.apiKey,
      config.agentId,
      config.baseUrl ?? "https://api.payclaw.me/v1",
      config.timeoutMs ?? 10_000
    );
    this._defaultAgent = new GripAgent(this.http, config.agentId);
  }

  // ─── Direct Payments (PayClawVault) ────────────────────────────────────────

  /**
   * Pay from the default agent to any destination.
   *
   * @example
   * await payclaw.pay('OpenAI', 20.00, 'GPT-4 API credits')
   */
  async pay(to: string, amountUsdc: number, memo?: string): Promise<PayResult> {
    if (amountUsdc <= 0) throw new PayClawValidationError("Amount must be > 0.");
    if (!to) throw new PayClawValidationError("Destination is required.");
    if (!memo) throw new PayClawValidationError("Memo is required for every payment.");

    const result = await this._defaultAgent.pay(to, amountUsdc, { memo });

    if (result.status === "pending_approval" && this.config.onApprovalNeeded) {
      await this.config.onApprovalNeeded(result);
    }

    return result;
  }

  /** Check if a payment of this amount would be allowed. */
  async canPay(amount: number): Promise<CanPayResponse> {
    if (amount <= 0) throw new PayClawValidationError("Amount must be > 0.");
    return this._defaultAgent.canPay(amount);
  }

  /** Get spending limits. */
  async limits(): Promise<LimitsResponse> {
    return this._defaultAgent.limits();
  }

  // ─── Escrow Payments (ServiceEscrow) ───────────────────────────────────────

  /**
   * Create a trustless escrow. Funds released when you call release().
   *
   * @example
   * const escrow = await payclaw.escrow('0xpayee...', 5.00, { serviceId: 'translation' })
   * await payclaw.release(escrow.escrowId)
   */
  async escrow(
    payeeAddress: string,
    amountUsdc: number,
    options?: EscrowOptions
  ): Promise<EscrowResult> {
    return this._defaultAgent.escrow(payeeAddress, amountUsdc, options);
  }

  /** Release escrow — confirms delivery and pays the payee. */
  async release(escrowId: string): Promise<ReleaseResult> {
    return this._defaultAgent.release(escrowId);
  }

  /** Refund an expired escrow. */
  async refund(escrowId: string) {
    return this._defaultAgent.refund(escrowId);
  }

  /** Dispute an escrow. */
  async dispute(escrowId: string) {
    return this._defaultAgent.dispute(escrowId);
  }

  // ─── Balance & History ─────────────────────────────────────────────────────

  /** Get the unified balance (vault - pending). */
  async balance(): Promise<BalanceResponse> {
    return this._defaultAgent.balance();
  }

  /** Transaction history. */
  async history(filters?: HistoryFilters): Promise<HistoryResponse> {
    return this._defaultAgent.history(filters);
  }

  // ─── Top-up ────────────────────────────────────────────────────────────────

  /** Initiate a balance top-up. */
  async topup(amount: number, method: TopupMethod = "crypto"): Promise<TopupResult> {
    if (amount <= 0) throw new PayClawValidationError("Amount must be > 0.");
    return this.http.post<TopupResult>("/topup", { amount, method });
  }

  // ─── Destinations ──────────────────────────────────────────────────────────

  /** List all whitelisted payment destinations. */
  async destinations(): Promise<Destination[]> {
    return this.http.get<Destination[]>("/destinations");
  }

  /** Request a new destination to be whitelisted. */
  async requestDestination(
    name: string,
    details: DestinationRequestDetails = {}
  ): Promise<DestinationRequestResult> {
    if (!name) throw new PayClawValidationError("Destination name is required.");
    return this.http.post<DestinationRequestResult>("/destinations/request", {
      name,
      ...details,
    });
  }

  // ─── Pix ───────────────────────────────────────────────────────────────────

  /**
   * Generate a Pix QR code to fund the wallet (BRL → USDC).
   *
   * @example
   * const { qrCode, amountUsdc } = await payclaw.pixDeposit(500) // R$500
   */
  async pixDeposit(amountBrl: number): Promise<PixDepositResult> {
    return this._defaultAgent.pixDeposit(amountBrl);
  }

  /** Withdraw from wallet via Pix (USDC → BRL). */
  async pixWithdraw(amountBrl: number, pixKey: string): Promise<PixWithdrawResult> {
    return this._defaultAgent.pixWithdraw(amountBrl, pixKey);
  }

  /** Get current BRL/USDC exchange rate. */
  async pixRate(): Promise<PixRate> {
    return this.http.get<PixRate>("/pix/rate");
  }

  // ─── Multi-Agent ───────────────────────────────────────────────────────────

  /**
   * Get a scoped interface for a specific agent.
   *
   * @example
   * const researcher = payclaw.agent('researcher-agent')
   * await researcher.pay('Dataset API', 10.00, { memo: 'training data' })
   * await researcher.escrow('0xpayee...', 5.00)
   */
  agent(agentId: string): GripAgent {
    return new GripAgent(this.http, agentId);
  }

  // ─── Agent Management ─────────────────────────────────────────────────────

  /** Create a new agent. */
  async createAgent(
    config: AgentConfig & { agentId: string }
  ): Promise<AgentInfo> {
    return this.http.post<AgentInfo>("/agents/register", {
      modelVersion: config.modelVersion ?? "unknown",
      skillset: config.capabilities ?? [],
    });
  }

  /** List all agents for this API key. */
  async agents(): Promise<AgentInfo[]> {
    return this.http.get<AgentInfo[]>("/agents");
  }
}
