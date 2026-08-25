import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SimClockService } from './sim-clock.service';

@Controller('sim')
@UseGuards(JwtAuthGuard)
export class SimClockController {
  constructor(private simClock: SimClockService) {}

  @Get('current-day')
  getCurrentDay() {
    return { currentDay: this.simClock.getCurrentDay() };
  }

  // Dashboard "+N days" button hits this. Returns which promises came
  // due so the frontend/recovery-engine can react — actually resolving
  // those promises into RECOVERED/ESCALATED happens in a follow-up
  // piece (promise-resolution handler) we'll build next.
  @Post('advance')
  async advance(@Body('days') days: number) {
    return this.simClock.advanceDays(days ?? 1);
  }
}
