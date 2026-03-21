import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { GripService } from '../grip/grip.service';
import { SupabaseService } from '../supabase/supabase.service';
import { keccak256, toHex, type Address } from 'viem';

export interface CreateAgentDto {
  name: string;
  modelVersion: string;
  capabilities: string[];
  agentId: string;
  walletAddress?: string;
}

export interface IssueSessionKeyDto {
  dailyLimitUsdc: number;
  perTxLimitUsdc: number;
  escalationUsdc: number;
  validForHours: number;
  allowedContracts?: string[];
}

@Injectable()
export class AgentsService {
  constructor(
    private grip: GripService,
    private supabase: SupabaseService,
  ) {}

  async create(apiKeyId: string, dto: CreateAgentDto) {
    // Check for duplicate agentId within owner
    const { data: existing } = await this.supabase.db
      .from('agents')
      .select('id')
      .eq('api_key_id', apiKeyId)
      .eq('agent_id', dto.agentId)
      .single();

    if (existing) throw new ConflictException(`Agent "${dto.agentId}" already exists`);

    const { data, error } = await this.supabase.db
      .from('agents')
      .insert({
        api_key_id: apiKeyId,
        agent_id: dto.agentId,
        name: dto.name,
        model_version: dto.modelVersion,
        wallet_address: dto.walletAddress ?? null,
        on_chain: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async registerOnChain(agentDbId: string, walletAddress: Address) {
    const { data: agent } = await this.supabase.db
      .from('agents')
      .select('*')
      .eq('id', agentDbId)
      .single();

    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.on_chain) throw new ConflictException('Agent already registered on-chain');

    // Register DID on Grip Protocol
    const skillset: `0x${string}`[] = [];
    const txHash = await this.grip.registerAgent(agent.model_version ?? 'unknown', skillset);
    await this.grip.waitForTx(txHash);

    // Update DB
    await this.supabase.db
      .from('agents')
      .update({
        on_chain: true,
        on_chain_tx: txHash,
        wallet_address: walletAddress,
      })
      .eq('id', agentDbId);

    return { txHash, agentAddress: walletAddress };
  }

  async issueSessionKey(agentDbId: string, dto: IssueSessionKeyDto) {
    const { data: agent } = await this.supabase.db
      .from('agents')
      .select('*')
      .eq('id', agentDbId)
      .single();

    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.wallet_address) throw new ConflictException('Agent has no wallet address');

    const validUntil = BigInt(Math.floor(Date.now() / 1000) + dto.validForHours * 3600);
    const dailyLimit = this.grip.parseUsdc(dto.dailyLimitUsdc);
    const perTxLimit = this.grip.parseUsdc(dto.perTxLimitUsdc);
    const escalation = this.grip.parseUsdc(dto.escalationUsdc);

    const txHash = await this.grip.grantSessionKey(agent.wallet_address as Address, {
      validUntil,
      allowedContracts: (dto.allowedContracts ?? []) as Address[],
      dailySpendingLimit: dailyLimit,
      perTxLimit: perTxLimit,
      escalationThreshold: escalation,
    });

    const receipt = await this.grip.waitForTx(txHash);

    // Derive keyId from tx (would normally read from event)
    const keyId = txHash;

    await this.supabase.db.from('session_keys').insert({
      agent_id: agentDbId,
      key_id: keyId,
      tx_hash: txHash,
      daily_limit_usdc: dto.dailyLimitUsdc,
      per_tx_limit_usdc: dto.perTxLimitUsdc,
      escalation_usdc: dto.escalationUsdc,
      valid_until: new Date(Number(validUntil) * 1000).toISOString(),
      allowed_contracts: dto.allowedContracts ?? [],
    });

    return { keyId, txHash };
  }

  async findAll(apiKeyId: string) {
    const { data } = await this.supabase.db
      .from('agents')
      .select('*, session_keys(*)')
      .eq('api_key_id', apiKeyId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async findOne(apiKeyId: string, agentId: string) {
    const { data } = await this.supabase.db
      .from('agents')
      .select('*, session_keys(*), payments(*)')
      .eq('api_key_id', apiKeyId)
      .eq('agent_id', agentId)
      .single();

    if (!data) throw new NotFoundException(`Agent "${agentId}" not found`);

    // Enrich with on-chain data if registered
    let onChainInfo = null;
    if (data.on_chain && data.wallet_address) {
      try {
        onChainInfo = await this.grip.getAgent(data.wallet_address as Address);
      } catch {}
    }

    return { ...data, on_chain_info: onChainInfo };
  }
}
