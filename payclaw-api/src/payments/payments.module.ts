// ─── payments.module.ts ────────────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GripModule } from '../grip/grip.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

export { PaymentsModule };

@Module({
  imports: [GripModule, SupabaseModule, AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
class PaymentsModule {}
