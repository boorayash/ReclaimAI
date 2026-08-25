import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { RecoveryEngineService } from './recovery-engine.service';
import { PolicyEngineService } from './policy-engine.service';
import { AiDiagnosisService } from './ai-diagnosis.service';
import { SimClockModule } from '../sim-clock/sim-clock.module';

@Module({
  imports: [SimClockModule],
  controllers: [CasesController],
  providers: [RecoveryEngineService, PolicyEngineService, AiDiagnosisService],
  exports: [RecoveryEngineService],
})
export class RecoveryEngineModule {}
