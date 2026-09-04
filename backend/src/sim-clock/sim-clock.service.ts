import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// A single shared "current day" for the whole demo — persisted to DB
// so it survives server restarts (Render free-tier spin-down, local
// dev restarts, etc.). Singleton row (id: 1).
@Injectable()
export class SimClockService {
  private readonly logger = new Logger(SimClockService.name);

  constructor(private prisma: PrismaService) {}

  async getCurrentDay(): Promise<number> {
    const clock = await this.prisma.simClock.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, currentDay: 0 },
    });
    return clock.currentDay;
  }

  /**
   * Advances the simulated clock by N days and returns any promises
   * that came due (fulfilled or not) in that window, so the caller
   * (recovery-engine) can react — mark RECOVERED or send the case
   * back to DIAGNOSING with an escalated tone.
   */
  async advanceDays(days: number) {
    const fromDay = await this.getCurrentDay();
    const toDay = fromDay + days;

    await this.prisma.simClock.upsert({
      where: { id: 1 },
      update: { currentDay: toDay },
      create: { id: 1, currentDay: toDay },
    });

    this.logger.log(`Sim clock advanced: day ${fromDay} -> ${toDay}`);

    const duePromises = await this.prisma.promise.findMany({
      where: {
        promisedBySimDay: { lte: toDay },
        fulfilled: false,
      },
      include: { case: true },
    });

    return {
      fromDay,
      toDay,
      duePromises,
    };
  }
}
