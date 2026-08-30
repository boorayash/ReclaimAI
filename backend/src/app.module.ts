import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RecoveryEngineModule } from './recovery-engine/recovery-engine.module';
import { SimClockModule } from './sim-clock/sim-clock.module';
import { BatchModule } from './batch/batch.module';

@Module({
  imports: [PrismaModule, AuthModule, SimClockModule, RecoveryEngineModule, BatchModule],
})
export class AppModule {}