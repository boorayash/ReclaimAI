import { Module } from '@nestjs/common';
import { SimClockService } from './sim-clock.service';
import { SimClockController } from './sim-clock.controller';

@Module({
  controllers: [SimClockController],
  providers: [SimClockService],
  exports: [SimClockService],
})
export class SimClockModule {}
