import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksListener } from './webhooks.listener';
import { SupabaseModule } from '../supabase/supabase.module';
import { GripModule } from '../grip/grip.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, GripModule, AuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksListener],
  exports: [WebhooksService],
})
export class WebhooksModule {}
