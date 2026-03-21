import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { keccak256, toHex, type Address } from 'viem';
import { GripService } from '../grip/grip.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface PayDto {
  agentId: string;
  to: string;         // address or agentId
  amountUsdc: number;
  memo?: string;
}

export interface CreateEscrowDto {
  agentId: string;
  payeeAddress: string;
  amountUsdc: number;
  serviceId: string;
  commitHash?: string;
  timeoutSeconds?: number;
  memo?: string;
}

export interface ReleaseEscrowDto {
  escrowId: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private grip: GripService,
    private supabase: SupabaseService,
  ) {}

  // ─── Direct Payment ─────────────────────────────────────────────────────

  async pay(apiKeyId: string, dto: PayDto) {
    const agent = await this.resolveAgent(apiKeyId, dto.agentId);
    const amountBigInt = this.grip.parseUsdc(dto.amountUsdc);

    // Log payment as pending
    const { data: payment } = await this.supabase.db
      .from('payments')
      .insert({
        agent_id: agent.id,
        type: 'direct',
        direction: 'outbound',
        status: 'pending',
        amount_usdc: dto.amountUsdc,
        to_address: dto.to,
        memo: dto.memo,
      })
      .select()
      .single();

    try {
      // Execute on-chain transfer via ServiceEscrow (direct = instant release)
      const serviceId = keccak256(toHex(`direct-${payment!.id}`));
      const commitHash = keccak256(toHex('direct'));

      const txHash = await this.grip.createEscrow(
        dto.to as Address,
        amountBigInt,
        serviceId,
        commitHash,
        BigInt(1), // 1 second timeout — immediately refundable for direct pays
      );

      await this.grip.waitForTx(txHash);

      // Release immediately for direct payments
      // In production: payee calls releaseEscrow — this is simplified
      await this.supabase.db
        .from('payments')
        .update({ status: 'confirmed', tx_hash: txHash })
        .eq('id', payment!.id);

      return {
        id: payment!.id,
        status: 'confirmed',
        txHash,
        amountUsdc: dto.amountUsdc,
        fee: dto.amountUsdc * 0.001,
        to: dto.to,
      };
    } catch (err) {
      await this.supabase.db
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment!.id);
      throw err;
    }
  }

  // ─── Escrow Payment ─────────────────────────────────────────────────────

  async createEscrow(apiKeyId: string, dto: CreateEscrowDto) {
    const agent = await this.resolveAgent(apiKeyId, dto.agentId);
    const amountBigInt = this.grip.parseUsdc(dto.amountUsdc);
    const timeoutSeconds = BigInt(dto.timeoutSeconds ?? 300); // 5 min default

    const serviceId = keccak256(toHex(dto.serviceId));
    const commitHash = dto.commitHash
      ? (dto.commitHash as `0x${string}`)
      : keccak256(toHex('no-commit'));

    const { data: payment } = await this.supabase.db
      .from('payments')
      .insert({
        agent_id: agent.id,
        type: 'escrow',
        direction: 'outbound',
        status: 'pending',
        amount_usdc: dto.amountUsdc,
        to_address: dto.payeeAddress,
        memo: dto.memo,
        metadata: { serviceId: dto.serviceId, timeoutSeconds: dto.timeoutSeconds },
      })
      .select()
      .single();

    const txHash = await this.grip.createEscrow(
      dto.payeeAddress as Address,
      amountBigInt,
      serviceId,
      commitHash,
      timeoutSeconds,
    );

    const receipt = await this.grip.waitForTx(txHash);

    // Parse escrowId from logs — simplified: use nextEscrowId - 1
    // In production: parse EscrowCreated event from receipt.logs
    const escrowId = Date.now(); // placeholder — replace with event parsing

    await this.supabase.db
      .from('payments')
      .update({
        status: 'confirmed',
        tx_hash: txHash,
        escrow_id: escrowId,
      })
      .eq('id', payment!.id);

    return {
      id: payment!.id,
      escrowId,
      txHash,
      status: 'confirmed',
      amountUsdc: dto.amountUsdc,
      payeeAddress: dto.payeeAddress,
      timeoutSeconds: dto.timeoutSeconds ?? 300,
    };
  }

  async releaseEscrow(apiKeyId: string, escrowId: number) {
    const { data: payment } = await this.supabase.db
      .from('payments')
      .select('*, agents!inner(api_key_id)')
      .eq('escrow_id', escrowId)
      .single();

    if (!payment) throw new NotFoundException(`Escrow ${escrowId} not found`);

    const txHash = await this.grip.releaseEscrow(BigInt(escrowId));
    await this.grip.waitForTx(txHash);

    await this.supabase.db
      .from('payments')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('escrow_id', escrowId);

    return { escrowId, txHash, status: 'released' };
  }

  async refundExpired(escrowId: number) {
    const txHash = await this.grip.refundOnTimeout(BigInt(escrowId));
    await this.grip.waitForTx(txHash);

    await this.supabase.db
      .from('payments')
      .update({ status: 'refunded' })
      .eq('escrow_id', escrowId);

    return { escrowId, txHash, status: 'refunded' };
  }

  // ─── History ────────────────────────────────────────────────────────────

  async getHistory(apiKeyId: string, agentId?: string) {
    let query = this.supabase.db
      .from('payments')
      .select('*, agents!inner(api_key_id, agent_id)')
      .eq('agents.api_key_id', apiKeyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (agentId) {
      query = query.eq('agents.agent_id', agentId);
    }

    const { data } = await query;
    return data ?? [];
  }

  async getBalance(apiKeyId: string, agentId: string) {
    const agent = await this.resolveAgent(apiKeyId, agentId);
    if (!agent.wallet_address) return { usdc: 0, address: null };

    const balance = await this.grip.usdcBalanceOf(agent.wallet_address as Address);
    return {
      usdc: Number(balance) / 1_000_000,
      address: agent.wallet_address,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async resolveAgent(apiKeyId: string, agentId: string) {
    const { data } = await this.supabase.db
      .from('agents')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .eq('agent_id', agentId)
      .single();

    if (!data) throw new NotFoundException(`Agent "${agentId}" not found`);
    return data;
  }
}
