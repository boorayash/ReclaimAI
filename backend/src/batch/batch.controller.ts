import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BatchService } from './batch.service';
import { RunBatchDto } from './dto/run-batch.dto';

// Batch demo trigger — ADMIN only. Generates one of each named scenario
// template, resolves them, and returns a by-outcome summary.
@Controller('batch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(private batch: BatchService) {}

  @Post('run')
  @Roles('ADMIN')
  async run(@Body() dto: RunBatchDto, @CurrentUser() user: any) {
    return this.batch.run(dto.countPerTemplate ?? 2, user.userId);
  }
}
