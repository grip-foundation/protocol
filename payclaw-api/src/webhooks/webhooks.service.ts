import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

export type WebhookEvent =
  | 'payment.confirmed'
  | 'payment.failed'
  | 'escrow.created'
  | 'escrow.released'
  | 'escrow.refunded'
  | 'escrow.disputed'
  | 'pix.received'
  | 'pix.sent'
  | 'agent.registered'
  | 'session_key.tripped';

export interface RegisterWebhookDto {
  url: string;
  events: WebhookEvent[];
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private supabase: SupabaseService) {}

  // ─── Register ────────────────────────────────────────────────────────────

  async register(ownerId: string, dto: RegisterWebhookDto) {
    const secret = `whsec_${randomBytes(32).toString('hex')}`;

    const { data } = await this.supabase.db
      .from('webhooks')
      .insert({
        owner_id: ownerId,
        url: dto.url,
        events: dto.events,
        secret,
        active: true,
      })
      .select()
      .single();

    return {
      id: data!.id,
      url: dto.url,
      events: dto.events,
      secret, // shown once — user must save this
      createdAt: data!.created_at,
    };
  }

  async list(ownerId: string) {
    const { data } = await this.supabase.db
      .from('webhooks')
      .select('id, url, events, active, created_at')
      .eq('owner_id', ownerId)
      .eq('active', true);
    return data ?? [];
  }

  async revoke(ownerId: string, webhookId: string) {
    await this.supabase.db
      .from('webhooks')
      .update({ active: false })
      .eq('id', webhookId)
      .eq('owner_id', ownerId);
    return { revoked: true };
  }

  // ─── Dispatch ────────────────────────────────────────────────────────────

  async dispatch(ownerId: string, event: WebhookEvent, payload: Record<string, any>) {
    const { data: webhooks } = await this.supabase.db
      .from('webhooks')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('active', true)
      .contains('events', [event]);

    if (!webhooks?.length) return;

    const body = {
      id: `evt_${randomBytes(16).toString('hex')}`,
      type: event,
      created: Math.floor(Date.now() / 1000),
      data: payload,
    };

    for (const webhook of webhooks) {
      await this.deliver(webhook, body);
    }
  }

  private async deliver(webhook: any, body: Record<string, any>) {
    const bodyStr = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', webhook.secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex');

    const { data: delivery } = await this.supabase.db
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event: body.type,
        payload: body,
        status: 'pending',
      })
      .select()
      .single();

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'payclaw-signature': `t=${timestamp},v1=${signature}`,
          'payclaw-webhook-id': delivery!.id,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await this.supabase.db
          .from('webhook_deliveries')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', delivery!.id);

        this.logger.log(`Webhook delivered: ${body.type} → ${webhook.url}`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      await this.supabase.db
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts: (delivery!.attempts ?? 0) + 1,
          last_error: err.message,
        })
        .eq('id', delivery!.id);

      this.logger.error(`Webhook failed: ${body.type} → ${webhook.url} — ${err.message}`);
    }
  }
}
