import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentsModule } from './agents/agents.module';
import { PaymentsModule } from './payments/payments.module';
import { PixModule } from './pix/pix.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuthModule } from './auth/auth.module';
import { GripModule } from './grip/grip.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    SupabaseModule,
    GripModule,
    AuthModule,
    AgentsModule,
    PaymentsModule,
    PixModule,
    WebhooksModule,
  ],
})
export class AppModule {}
