import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createPublicClient, http, parseAbiItem, type Log } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { WebhooksService } from './webhooks.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WebhooksListener implements OnModuleInit {
  private readonly logger = new Logger(WebhooksListener.name);
  private publicClient: any;
  private serviceEscrowAddress: `0x${string}`;
  private lastProcessedBlock = 0n;

  constructor(
    private config: ConfigService,
    private webhooks: WebhooksService,
    private supabase: SupabaseService,
  ) {}

  onModuleInit() {
    const chain = this.config.get('CHAIN') === 'base' ? base : baseSepolia;
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.get('RPC_URL')),
    });
    this.serviceEscrowAddress = this.config.get<`0x${string}`>('SERVICE_ESCROW_ADDRESS')!;
    this.logger.log('On-chain event listener initialized');
  }

  // Poll every 15 seconds for new escrow events
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollEscrowEvents() {
    try {
      const latest = await this.publicClient.getBlockNumber();
      if (this.lastProcessedBlock === 0n) {
        this.lastProcessedBlock = latest - 10n; // start 10 blocks back
      }
      if (latest <= this.lastProcessedBlock) return;

      const fromBlock = this.lastProcessedBlock + 1n;
      const toBlock = latest;

      // EscrowCreated
      const created = await this.publicClient.getLogs({
        address: this.serviceEscrowAddress,
        event: parseAbiItem(
          'event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, bytes32 serviceId)',
        ),
        fromBlock,
        toBlock,
      });

      for (const log of created) {
        await this.handleEscrowCreated(log);
      }

      // EscrowReleased
      const released = await this.publicClient.getLogs({
        address: this.serviceEscrowAddress,
        event: parseAbiItem('event EscrowReleased(uint256 indexed escrowId, uint256 fee)'),
        fromBlock,
        toBlock,
      });

      for (const log of released) {
        await this.handleEscrowReleased(log);
      }

      // EscrowRefunded
      const refunded = await this.publicClient.getLogs({
        address: this.serviceEscrowAddress,
        event: parseAbiItem('event EscrowRefunded(uint256 indexed escrowId)'),
        fromBlock,
        toBlock,
      });

      for (const log of refunded) {
        await this.handleEscrowRefunded(log);
      }

      this.lastProcessedBlock = toBlock;
    } catch (err: any) {
      this.logger.error(`Poll error: ${err.message}`);
    }
  }

  private async handleEscrowCreated(log: any) {
    const { escrowId, payer, payee, amount } = log.args;
    this.logger.log(`EscrowCreated: #${escrowId} — ${payer} → ${payee}`);

    // Find the owner of the payment by payer address
    const { data: payment } = await this.supabase.db
      .from('payments')
      .select('*, agents!inner(api_key_id)')
      .eq('escrow_id', escrowId.toString())
      .single();

    if (payment) {
      await this.webhooks.dispatch(
        (payment as any).agents.api_key_id,
        'escrow.created',
        {
          escrowId: escrowId.toString(),
          payer,
          payee,
          amountUsdc: Number(amount) / 1_000_000,
          txHash: log.transactionHash,
        },
      );
    }
  }

  private async handleEscrowReleased(log: any) {
    const { escrowId, fee } = log.args;
    this.logger.log(`EscrowReleased: #${escrowId}`);

    const { data: payment } = await this.supabase.db
      .from('payments')
      .select('*, agents!inner(api_key_id)')
      .eq('escrow_id', escrowId.toString())
      .single();

    if (payment) {
      await this.supabase.db
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          tx_hash: log.transactionHash,
        })
        .eq('escrow_id', escrowId.toString());

      await this.webhooks.dispatch(
        (payment as any).agents.api_key_id,
        'escrow.released',
        {
          escrowId: escrowId.toString(),
          feeUsdc: Number(fee) / 1_000_000,
          txHash: log.transactionHash,
        },
      );
    }
  }

  private async handleEscrowRefunded(log: any) {
    const { escrowId } = log.args;
    this.logger.log(`EscrowRefunded: #${escrowId}`);

    await this.supabase.db
      .from('payments')
      .update({ status: 'refunded' })
      .eq('escrow_id', escrowId.toString());
  }
}
