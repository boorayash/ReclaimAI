import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecoveryEngineService } from '../recovery-engine/recovery-engine.service';
import { SimClockService } from '../sim-clock/sim-clock.service';

// Batch runner for the demo. POST /batch/run creates one of each named
// scenario template N times and scripts each to a known outcome, then
// advances the clock and summarizes by final status. Not a random
// generator — the point is to exercise every path we built.

const TEMPLATE_NAMES = [
  'quick_recovery',
  'promise_kept',
  'promise_broken',
  'disputed',
  'silent',
  'high_value_approved',
  'partial_then_full',
  'retry_recovers',
  'retry_exhausted',
] as const;

type TemplateName = (typeof TEMPLATE_NAMES)[number];

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  // Sequential throttle between cases — Groq free tier is ~30 req/min and
  // each case makes 1+ calls. Keeps the batch under the rate limit without
  // corrupting demo data with unintended fallback diagnoses.
  private static readonly THROTTLE_MS = 300;

  constructor(
    private prisma: PrismaService,
    private engine: RecoveryEngineService,
    private simClock: SimClockService,
  ) {}

  async run(countPerTemplate: number, approvedByUserId: string) {
    const createdCaseIds: string[] = [];
    const highValueIds: string[] = [];

    // Pass 1: create + script every template instance.
    for (let i = 0; i < countPerTemplate; i++) {
      for (const name of TEMPLATE_NAMES) {
        const id = await this.createTemplate(name, i);
        createdCaseIds.push(id);
        if (name === 'high_value_approved') highValueIds.push(id);
        await this.throttle();
      }
    }

    // Pass 2: single clock advance resolves all promise/silence timers.
    await this.engine.advanceClockAndResolve(10);

    // Pass 3: approve high-value cases LAST — approving before the clock
    // advance would leave them at ACTION_TAKEN and the NO_RESPONSE sweep
    // would escalate them. Approving after keeps them at "approved, executed".
    for (const id of highValueIds) {
      await this.engine.approveCase(id, approvedByUserId);
      await this.throttle();
    }

    return this.summarize(createdCaseIds);
  }

  private async createTemplate(name: TemplateName, i: number): Promise<string> {
    const day = await this.simClock.getCurrentDay();
    switch (name) {
      case 'quick_recovery': {
        const amount = 5000 * (i + 1);
        const id = await this.createB2b(`Quick Co #${i}`, amount, day + 1);
        await this.engine.handleClientResponse(id, 'ALREADY_PAID', {});
        return id;
      }
      case 'promise_kept': {
        const amount = 6000 * (i + 1);
        const id = await this.createB2b(`PromiseKept Co #${i}`, amount, day + 5);
        await this.engine.handleClientResponse(id, 'PROMISE_TO_PAY', {
          promisedAmount: amount,
          promisedBySimDay: day + 3,
        });
        await this.engine.handleClientResponse(id, 'PARTIAL_PAYMENT', {
          partialAmount: amount,
        });
        return id;
      }
      case 'promise_broken': {
        const amount = 7000 * (i + 1);
        const id = await this.createB2b(`PromiseBroken Co #${i}`, amount, day + 5);
        await this.engine.handleClientResponse(id, 'PROMISE_TO_PAY', {
          promisedAmount: amount,
          promisedBySimDay: day + 3,
        });
        return id;
      }
      case 'disputed': {
        const amount = 30000 * (i + 1);
        const id = await this.createB2b(`Disputed Co #${i}`, amount, day + 1);
        await this.engine.handleClientResponse(id, 'DISPUTE', {});
        return id;
      }
      case 'silent': {
        const amount = 4000 * (i + 1);
        const id = await this.createB2b(`Silent Co #${i}`, amount, day + 1);
        return id;
      }
      case 'high_value_approved': {
        // ≥ ₹1,00,000 -> PENDING_APPROVAL on first process; approved in pass 3.
        const amount = 200000 * (i + 1);
        return this.createB2b(`HighValue Co #${i}`, amount, day + 5);
      }
      case 'partial_then_full': {
        const amount = 8000 * (i + 1);
        const id = await this.createB2b(`Partial Co #${i}`, amount, day + 1);
        await this.engine.handleClientResponse(id, 'PARTIAL_PAYMENT', {
          partialAmount: amount / 2,
        });
        await this.engine.handleClientResponse(id, 'PARTIAL_PAYMENT', {
          partialAmount: amount / 2,
        });
        return id;
      }
      case 'retry_recovers': {
        // succeedsOnRetryAt=2 -> recovers on 2nd retry. Create processes once
        // (retry#1), one more /process is retry#2 -> RECOVERED.
        const amount = 5000 * (i + 1);
        const id = await this.createPaymentFailure(
          amount,
          'card_declined',
          2,
        );
        await this.engine.processCase(id);
        return id;
      }
      case 'retry_exhausted': {
        // no succeedsOnRetryAt, maxRetries=3 (default). Create = retry#1, +3
        // process calls -> retryCount 3 >= 3 -> UNRESOLVED.
        const amount = 4500 * (i + 1);
        const id = await this.createPaymentFailure(amount, 'insufficient_funds');
        await this.engine.processCase(id);
        await this.engine.processCase(id);
        await this.engine.processCase(id);
        return id;
      }
    }
  }

  // Creates a B2B case + invoice via the same nested shape the cases
  // controller uses, then runs it through the state machine once.
  private async createB2b(
    customerName: string,
    invoiceAmount: number,
    dueSimDay: number,
  ): Promise<string> {
    const kase = await this.prisma.case.create({
      data: {
        type: 'B2B_RECEIVABLE',
        invoice: { create: { customerName, invoiceAmount, dueSimDay } },
      },
    });
    await this.engine.processCase(kase.id);
    return kase.id;
  }

  private async createPaymentFailure(
    originalAmount: number,
    failureReason: string,
    succeedsOnRetryAt?: number,
  ): Promise<string> {
    const kase = await this.prisma.case.create({
      data: {
        type: 'PAYMENT_FAILURE',
        paymentAttempt: {
          create: { originalAmount, failureReason, succeedsOnRetryAt },
        },
      },
    });
    await this.engine.processCase(kase.id);
    return kase.id;
  }

  private async summarize(caseIds: string[]) {
    const cases = await this.prisma.case.findMany({
      where: { id: { in: caseIds } },
      select: { status: true },
    });
    const byOutcome: Record<string, number> = {};
    for (const kase of cases) {
      byOutcome[kase.status] = (byOutcome[kase.status] ?? 0) + 1;
    }
    return { totalCreated: caseIds.length, byOutcome };
  }

  private throttle() {
    return new Promise((r) => setTimeout(r, BatchService.THROTTLE_MS));
  }
}
