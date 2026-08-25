import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// A single in-memory "current day" for the whole demo (not per-case —
// one shared timeline, like a fast-forward button on the dashboard).
// Advancing the clock checks every open Promise to see if its due day
// has passed, and flags broken promises for re-diagnosis. This is what
// makes "client promised payment in 2 days" demoable without waiting
// 2 real days.
@Injectable()
export class SimClockService {
  private readonly logger = new Logger(SimClockService.name);
  private currentDay = 0;

  constructor(private prisma: PrismaService) {}

  getCurrentDay(): number {
    return this.currentDay;
  }

  /**
   * Advances the simulated clock by N days and returns any promises
   * that came due (fulfilled or not) in that window, so the caller
   * (recovery-engine) can react — mark RECOVERED or send the case
   * back to DIAGNOSING with an escalated tone.
   */
  async advanceDays(days: number) {
    const fromDay = this.currentDay;
    this.currentDay += days;
    this.logger.log(`Sim clock advanced: day ${fromDay} -> ${this.currentDay}`);

    const duePromises = await this.prisma.promise.findMany({
      where: {
        promisedBySimDay: { lte: this.currentDay },
        fulfilled: false,
      },
      include: { case: true },
    });

    return {
      fromDay,
      toDay: this.currentDay,
      duePromises, // recovery-engine.service.ts processes each of these
    };
  }

  reset() {
    this.currentDay = 0;
  }
}
