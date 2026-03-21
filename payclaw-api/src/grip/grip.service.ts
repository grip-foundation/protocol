import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getContract,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

// ─── ABIs (minimal — only functions we call) ────────────────────────────

const AGENT_DID_ABI = parseAbi([
  'function registerAgent(string modelVersion, bytes32[] skillset) external',
  'function getAgent(address agent) external view returns ((address createdBy, string modelVersion, bytes32[] skillset, uint256 operationalSince, uint256 reputationScore, uint256 totalTxs, uint256 successRate))',
  'function agentExists(address agent) external view returns (bool)',
  'event AgentRegistered(address indexed agent, address indexed creator, string modelVersion)',
]);

const SERVICE_ESCROW_ABI = parseAbi([
  'function createEscrow(address payee, uint256 amount, bytes32 serviceId, bytes32 commitHash, uint256 timeout) external returns (uint256 escrowId)',
  'function releaseEscrow(uint256 escrowId) external',
  'function refundOnTimeout(uint256 escrowId) external',
  'function dispute(uint256 escrowId) external',
  'function escrows(uint256) external view returns (address payer, address payee, uint256 amount, bytes32 serviceId, bytes32 commitHash, uint256 timeout, uint256 createdAt, uint8 status)',
  'event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, bytes32 serviceId)',
  'event EscrowReleased(uint256 indexed escrowId, uint256 fee)',
  'event EscrowRefunded(uint256 indexed escrowId)',
]);

const SESSION_KEY_ABI = parseAbi([
  'function setAgentOwner(address agent) external',
  'function grantSessionKey(address agent, (uint256 validUntil, address[] allowedContracts, uint256 dailySpendingLimit, uint256 perTxLimit, uint256 escalationThreshold) params) external returns (bytes32 keyId)',
  'function revokeSessionKey(address agent, bytes32 keyId) external',
  'function validateSession(address agent, bytes32 keyId, address target, uint256 amount) external returns (bool)',
]);

const AGENT_REGISTRY_ABI = parseAbi([
  'function register(string[] capabilities, uint256 pricePerCall, string endpoint, uint256 slaSeconds) external',
  'function getProfile(address agent) external view returns ((string[] capabilities, uint256 pricePerCall, string endpoint, uint256 slaSeconds, bool active))',
]);

const USDC_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

// ─── Types ──────────────────────────────────────────────────────────────

export interface AgentInfo {
  createdBy: Address;
  modelVersion: string;
  skillset: `0x${string}`[];
  operationalSince: bigint;
  reputationScore: bigint;
  totalTxs: bigint;
  successRate: bigint;
}

export interface EscrowInfo {
  payer: Address;
  payee: Address;
  amount: bigint;
  serviceId: `0x${string}`;
  commitHash: `0x${string}`;
  timeout: bigint;
  createdAt: bigint;
  status: number; // 0=Created, 1=Released, 2=Refunded, 3=Disputed
}

@Injectable()
export class GripService implements OnModuleInit {
  private readonly logger = new Logger(GripService.name);

  private publicClient: PublicClient;
  private walletClient: WalletClient;

  private agentDIDAddress: Address;
  private serviceEscrowAddress: Address;
  private sessionKeyManagerAddress: Address;
  private agentRegistryAddress: Address;
  private usdcAddress: Address;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const chain = this.config.get('CHAIN') === 'base' ? base : baseSepolia;
    const rpcUrl = this.config.get<string>('RPC_URL');
    const privateKey = this.config.get<string>('DEPLOYER_PRIVATE_KEY') as `0x${string}`;

    const account = privateKeyToAccount(privateKey);

    this.publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    this.walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

    this.agentDIDAddress = this.config.get<Address>('AGENT_DID_ADDRESS')!;
    this.serviceEscrowAddress = this.config.get<Address>('SERVICE_ESCROW_ADDRESS')!;
    this.sessionKeyManagerAddress = this.config.get<Address>('SESSION_KEY_MANAGER_ADDRESS')!;
    this.agentRegistryAddress = this.config.get<Address>('AGENT_REGISTRY_ADDRESS')!;
    this.usdcAddress = this.config.get<Address>('USDC_ADDRESS')!;

    this.logger.log(`Grip connected — chain: ${chain.name}`);
    this.logger.log(`AgentDID: ${this.agentDIDAddress}`);
    this.logger.log(`ServiceEscrow: ${this.serviceEscrowAddress}`);
  }

  // ─── AgentDID ───────────────────────────────────────────────────────

  async agentExists(agentAddress: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.agentDIDAddress,
      abi: AGENT_DID_ABI,
      functionName: 'agentExists',
      args: [agentAddress],
    });
  }

  async getAgent(agentAddress: Address): Promise<AgentInfo> {
    const result = await this.publicClient.readContract({
      address: this.agentDIDAddress,
      abi: AGENT_DID_ABI,
      functionName: 'getAgent',
      args: [agentAddress],
    });
    return result as AgentInfo;
  }

  async registerAgent(modelVersion: string, skillset: `0x${string}`[]): Promise<Hash> {
    return this.walletClient.writeContract({
      address: this.agentDIDAddress,
      abi: AGENT_DID_ABI,
      functionName: 'registerAgent',
      args: [modelVersion, skillset],
    });
  }

  // ─── ServiceEscrow ──────────────────────────────────────────────────

  async createEscrow(
    payeeAddress: Address,
    amountUsdc: bigint,
    serviceId: `0x${string}`,
    commitHash: `0x${string}`,
    timeoutSeconds: bigint,
  ): Promise<Hash> {
    // First approve USDC spend
    await this.walletClient.writeContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [this.serviceEscrowAddress, amountUsdc],
    });

    return this.walletClient.writeContract({
      address: this.serviceEscrowAddress,
      abi: SERVICE_ESCROW_ABI,
      functionName: 'createEscrow',
      args: [payeeAddress, amountUsdc, serviceId, commitHash, timeoutSeconds],
    });
  }

  async releaseEscrow(escrowId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: this.serviceEscrowAddress,
      abi: SERVICE_ESCROW_ABI,
      functionName: 'releaseEscrow',
      args: [escrowId],
    });
  }

  async refundOnTimeout(escrowId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: this.serviceEscrowAddress,
      abi: SERVICE_ESCROW_ABI,
      functionName: 'refundOnTimeout',
      args: [escrowId],
    });
  }

  async getEscrow(escrowId: bigint): Promise<EscrowInfo> {
    const result = await this.publicClient.readContract({
      address: this.serviceEscrowAddress,
      abi: SERVICE_ESCROW_ABI,
      functionName: 'escrows',
      args: [escrowId],
    });
    const [payer, payee, amount, serviceId, commitHash, timeout, createdAt, status] = result as any[];
    return { payer, payee, amount, serviceId, commitHash, timeout, createdAt, status };
  }

  // ─── SessionKeyManager ──────────────────────────────────────────────

  async grantSessionKey(
    agentAddress: Address,
    params: {
      validUntil: bigint;
      allowedContracts: Address[];
      dailySpendingLimit: bigint;
      perTxLimit: bigint;
      escalationThreshold: bigint;
    },
  ): Promise<Hash> {
    return this.walletClient.writeContract({
      address: this.sessionKeyManagerAddress,
      abi: SESSION_KEY_ABI,
      functionName: 'grantSessionKey',
      args: [agentAddress, params],
    });
  }

  async revokeSessionKey(agentAddress: Address, keyId: `0x${string}`): Promise<Hash> {
    return this.walletClient.writeContract({
      address: this.sessionKeyManagerAddress,
      abi: SESSION_KEY_ABI,
      functionName: 'revokeSessionKey',
      args: [agentAddress, keyId],
    });
  }

  // ─── USDC ────────────────────────────────────────────────────────────

  async usdcBalanceOf(address: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
  }

  // ─── Utils ───────────────────────────────────────────────────────────

  async waitForTx(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  formatUsdc(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(6);
  }

  parseUsdc(amount: number): bigint {
    return BigInt(Math.round(amount * 1_000_000));
  }
}
