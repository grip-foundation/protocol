// ─── pix.module.ts ──────────────────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { PixController } from './pix.controller';
import { PixService } from './pix.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

export { PixModule };

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [PixController],
  providers: [PixService],
  exports: [PixService],
})
class PixModule {}
