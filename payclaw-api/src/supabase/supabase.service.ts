import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient<Database>;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.client = createClient<Database>(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_KEY')!,
    );
  }

  get db(): SupabaseClient<Database> {
    return this.client;
  }
}
