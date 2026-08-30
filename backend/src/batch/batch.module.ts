import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecoveryEngineModule } from '../recovery-engine/recovery-engine.module';
import { SimClockModule } from '../sim-clock/sim-clock.module';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

@Module({
  imports: [PrismaModule, RecoveryEngineModule, SimClockModule],
  controllers: [BatchController],
  providers: [BatchService],
})
export class BatchModule {}
