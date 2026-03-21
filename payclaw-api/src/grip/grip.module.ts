import { Module } from '@nestjs/common';
import { GripService } from './grip.service';

@Module({
  providers: [GripService],
  exports: [GripService],
})
export class GripModule {}
