import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

export interface PixDepositDto {
  agentId: string;
  amountBrl: number;
}

export interface PixWithdrawDto {
  agentId: string;
  amountBrl: number;
  pixKey: string;   // CPF, phone, email, or random key
}

@Injectable()
export class PixService {
  private readonly logger = new Logger(PixService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {
    this.apiUrl = this.config.get<string>('GLOBALPIX_API_URL')!;
    this.apiKey = this.config.get<string>('GLOBALPIX_API_KEY')!;
    this.webhookSecret = this.config.get<string>('GLOBALPIX_WEBHOOK_SECRET')!;
  }

  // ─── Generate Pix QR Code for deposit ──────────────────────────────────

  async generateDepositQr(apiKeyId: string, dto: PixDepositDto) {
    const rate = await this.getUsdcBrlRate();
    const amountUsdc = dto.amountBrl / rate;

    // Call GlobalPix API to generate QR
    const response = await this.callGlobalPix('POST', '/v1/pix/qr', {
      amount: dto.amountBrl,
      currency: 'BRL',
      description: `PayClaw deposit — ${dto.agentId}`,
      metadata: { agentId: dto.agentId, apiKeyId, amountUsdc },
    });

    // Store pending transaction
    const { data } = await this.supabase.db
      .from('pix_transactions')
      .insert({
        direction: 'in',
        status: 'pending',
        amount_brl: dto.amountBrl,
        amount_usdc: amountUsdc,
        rate_brl_usdc: rate,
        globalpix_id: response.id,
      })
      .select()
      .single();

    return {
      pixId: data!.id,
      qrCode: response.qrCode,
      qrCodeImage: response.qrCodeImage,
      amountBrl: dto.amountBrl,
      amountUsdc: Number(amountUsdc.toFixed(6)),
      rateBrlUsdc: rate,
      expiresAt: response.expiresAt,
    };
  }

  // ─── Pix Withdrawal (USDC → BRL) ────────────────────────────────────────

  async withdraw(apiKeyId: string, dto: PixWithdrawDto) {
    if (dto.amountBrl < 1) throw new BadRequestException('Minimum withdrawal is R$ 1.00');

    const rate = await this.getUsdcBrlRate();
    const amountUsdc = dto.amountBrl / rate;

    // Call GlobalPix to initiate transfer
    const response = await this.callGlobalPix('POST', '/v1/pix/transfer', {
      amount: dto.amountBrl,
      pixKey: dto.pixKey,
      description: `PayClaw withdrawal`,
    });

    const { data } = await this.supabase.db
      .from('pix_transactions')
      .insert({
        direction: 'out',
        status: 'pending',
        amount_brl: dto.amountBrl,
        amount_usdc: amountUsdc,
        rate_brl_usdc: rate,
        pix_key: dto.pixKey,
        e2e_id: response.e2eId,
        globalpix_id: response.id,
      })
      .select()
      .single();

    return {
      pixId: data!.id,
      e2eId: response.e2eId,
      amountBrl: dto.amountBrl,
      amountUsdc: Number(amountUsdc.toFixed(6)),
      status: 'pending',
      estimatedMinutes: 2,
    };
  }

  // ─── Handle incoming Pix webhook (deposit confirmed) ─────────────────────

  async handleWebhook(payload: any, signature: string) {
    // Verify HMAC signature from GlobalPix
    const isValid = this.verifyWebhookSignature(JSON.stringify(payload), signature);
    if (!isValid) throw new BadRequestException('Invalid webhook signature');

    const { type, data } = payload;

    if (type === 'pix.received') {
      await this.supabase.db
        .from('pix_transactions')
        .update({
          status: 'confirmed',
          e2e_id: data.e2eId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('globalpix_id', data.id);

      this.logger.log(`Pix deposit confirmed: ${data.e2eId} — R$ ${data.amount}`);
    }

    if (type === 'pix.sent') {
      await this.supabase.db
        .from('pix_transactions')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('e2e_id', data.e2eId);
    }

    return { received: true };
  }

  // ─── Rate ────────────────────────────────────────────────────────────────

  async getUsdcBrlRate(): Promise<number> {
    // In production: fetch from DolarAPI or CoinGecko
    // For now, hardcoded approximate rate
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=brl');
      const data = await res.json() as any;
      return data['usd-coin'].brl;
    } catch {
      return 5.8; // fallback
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async callGlobalPix(method: string, path: string, body?: any) {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`GlobalPix error: ${error}`);
    }

    return res.json();
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const { createHmac } = require('crypto');
    const expected = createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return `sha256=${expected}` === signature;
  }
}
