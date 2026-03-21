// ─── agents.module.ts ──────────────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { GripModule } from '../grip/grip.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

export { AgentsModule };

@Module({
  imports: [GripModule, SupabaseModule, AuthModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
class AgentsModule {}
