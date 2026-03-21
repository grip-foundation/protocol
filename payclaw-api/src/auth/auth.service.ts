import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

export interface ApiKeyPayload {
  id: string;
  owner_id: string;
  scopes: string[];
}

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  // Generate a new API key — returns the raw key (shown once) + prefix for storage
  generateApiKey(): { raw: string; hash: string; prefix: string } {
    const raw = `pc_live_${randomBytes(32).toString('hex')}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 12);
    return { raw, hash, prefix };
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyPayload> {
    const hash = createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await this.supabase.db
      .from('api_keys')
      .select('id, owner_id, scopes, revoked_at')
      .eq('key_hash', hash)
      .single();

    if (error || !data) throw new UnauthorizedException('Invalid API key');
    if (data.revoked_at) throw new UnauthorizedException('API key revoked');

    // Update last_used
    await this.supabase.db
      .from('api_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('id', data.id);

    return {
      id: data.id,
      owner_id: data.owner_id,
      scopes: data.scopes ?? ['pay', 'escrow', 'read'],
    };
  }
}
