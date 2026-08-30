import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiDiagnosisService } from './ai-diagnosis.service';
import { PolicyEngineService } from './policy-engine.service';
import { SimClockService } from '../sim-clock/sim-clock.service';

// This is the state machine described in the README:
//   detect -> diagnose -> decide -> act -> verify -> recover/escalate
//
// processCase() is idempotent-safe to call repeatedly on the same case
// (e.g. via the manual re-trigger endpoint, or after the sim clock
// advances) — it always reads current DB state first and acts on
// that, rather than assuming its own prior call succeeded.
@Injectable()
export class RecoveryEngineService {
  private readonly logger = new Logger(RecoveryEngineService.name);

    constructor(
    private prisma: PrismaService,
    private aiDiagnosis: AiDiagnosisService,
    private policyEngine: PolicyEngineService,
    private simClock: SimClockService,
  ) {}

  /**
   * Entry point. Called automatically on case creation, and callable
   * again manually (demo control, retries, or after a sim-clock tick).
   */
  async processCase(caseId: string) {
    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { invoice: true, paymentAttempt: true, recoveryActions: true },
    });

    switch (kase.status) {
      case 'DETECTED':
        return this.diagnoseAndDecide(caseId);
      case 'PENDING_APPROVAL':
        this.logger.log(`Case ${caseId} is awaiting human approval — no automatic action.`);
        return kase;
      case 'ACTION_TAKEN':
        // B2B awaits its outcome (promise resolution / client response) — no auto-retry.
        if (kase.type !== 'PAYMENT_FAILURE') {
          this.logger.log(`Case ${caseId} awaiting outcome — no automatic action.`);
          return kase;
        }
        // PAYMENT_FAILURE: a re-trigger means "the last attempt didn't recover —
        // retry or stop." Stop if we're out of retries, else loop back to a fresh
        // diagnosis + next retry (executeAction computes whether it recovers).
        {
          const totalPaid = await this.getTotalPaid(caseId);
          const expected = await this.getExpectedAmount(caseId);
          if (totalPaid >= expected) {
            // Money already came back (e.g. a client response landed) — settled, don't churn.
            this.logger.log(`Case ${caseId} already recovered — no further action.`);
            return kase;
          }
          const retryCount = kase.paymentAttempt?.retryCount ?? 0;
          const maxRetries = kase.paymentAttempt?.maxRetries ?? 3;
          if (retryCount >= maxRetries) {
            await this.prisma.case.update({
              where: { id: caseId },
              data: { status: 'UNRESOLVED' },
            });
            await this.logEvent(caseId, 'CASE_CLOSED_UNRESOLVED', {
              reason: `Retry limit reached (${retryCount}/${maxRetries}) — no payment recovered.`,
            });
            return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
          }
          return this.diagnoseAndDecide(caseId);
        }
      default:
        this.logger.log(`Case ${caseId} is in terminal/waiting state: ${kase.status}`);
        return kase;
    }
  }

  private async diagnoseAndDecide(caseId: string) {
    await this.prisma.case.update({
      where: { id: caseId },
      data: { status: 'DIAGNOSING' },
    });
    await this.logEvent(caseId, 'DIAGNOSIS_STARTED');

    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { invoice: true, paymentAttempt: true },
    });

    const details =
      kase.type === 'B2B_RECEIVABLE'
        ? {
            customerName: kase.invoice?.customerName,
            invoiceAmount: kase.invoice?.invoiceAmount,
            dueSimDay: kase.invoice?.dueSimDay,
            currentSimDay: kase.simDay,
          }
        : {
            originalAmount: kase.paymentAttempt?.originalAmount,
            failureReason: kase.paymentAttempt?.failureReason,
            retryCount: kase.paymentAttempt?.retryCount,
          };

    const diagnosis = await this.aiDiagnosis.diagnose({
      caseType: kase.type,
      details,
    });

    await this.logEvent(caseId, 'DIAGNOSIS_COMPLETE', diagnosis as any);

    const amount = Number(
      kase.type === 'B2B_RECEIVABLE'
        ? kase.invoice?.invoiceAmount ?? 0
        : kase.paymentAttempt?.originalAmount ?? 0,
    );
    const attemptNumber = (kase.paymentAttempt?.retryCount ?? 0) + 1;
    const maxRetries = kase.paymentAttempt?.maxRetries ?? 3;

    const decision = this.policyEngine.evaluate({
      diagnosis,
      amount,
      attemptNumber,
      maxRetries,
      hasDispute: false, // set true once a DISPUTE ClientResponse is wired in
    });

    await this.logEvent(caseId, 'POLICY_DECISION', decision as any);

    if (decision.requiresApproval) {
      await this.prisma.case.update({
        where: { id: caseId },
        data: { status: 'PENDING_APPROVAL', riskLevel: 'HIGH' },
      });
      await this.recordAction(caseId, diagnosis, 'PENDING' as any); // action recorded but not yet executed — case sits at PENDING_APPROVAL
      return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    }

    if (!decision.allowed) {
      await this.prisma.case.update({
        where: { id: caseId },
        data: { status: 'UNRESOLVED' },
      });
      await this.logEvent(caseId, 'CASE_CLOSED_UNRESOLVED', { reason: decision.reason });
      return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    }

    // Allowed and no approval needed — execute.
    return this.executeAction(caseId, diagnosis);
  }

    private async executeAction(caseId: string, diagnosis: any) {
    // NOTE: this is where a real integration (Razorpay retry API, an
    // email/SMS send, etc.) would be called. For the demo, this is
    // simulated — but the state transitions and audit trail are real.
    await this.recordAction(caseId, diagnosis, 'EXECUTED' as any);

    // Increment retry count so the policy engine's retry-limit rule
    // actually has real data to act on next time this case is processed,
    // and (PAYMENT_FAILURE) check whether THIS attempt is the one that
    // recovers. See succeedsOnRetryAt on PaymentAttempt.
    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { paymentAttempt: true },
    });

    if (kase.paymentAttempt) {
      const att = kase.paymentAttempt;
      const newCount = att.retryCount + 1;
      await this.prisma.paymentAttempt.update({
        where: { caseId },
        data: { retryCount: newCount },
      });

      // Deterministic recovery: recovers exactly on this retry, if assigned.
      if (att.succeedsOnRetryAt != null && newCount >= att.succeedsOnRetryAt) {
        const expected = await this.getExpectedAmount(caseId);
        await this.prisma.payment.create({
          data: { caseId, amount: expected, simDay: this.simClock.getCurrentDay() },
        });
        await this.recomputeRecoveryStatus(caseId); // -> RECOVERED
        await this.logEvent(caseId, 'RETRY_RECOVERED', {
          attempt: newCount,
          recoveredAmount: expected,
        });
        return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      }
    }

    await this.prisma.case.update({
      where: { id: caseId },
      data: { status: 'ACTION_TAKEN' },
    });

    await this.logEvent(caseId, 'ACTION_EXECUTED', {
      action: diagnosis.recommendedAction,
      decidedBy: diagnosis.decidedBy,
    });

    return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  }

  private async recordAction(caseId: string, diagnosis: any, status: string) {
    await this.prisma.recoveryAction.create({
      data: {
        caseId,
        actionType: diagnosis.recommendedAction,
        status: status as any,
        decidedBy: diagnosis.decidedBy,
        reasoning: diagnosis.reasoning,
      },
    });
  }

  private async logEvent(caseId: string, eventType: string, payload?: any) {
    await this.prisma.auditEvent.create({
      data: { caseId, eventType, payload: payload ?? undefined },
    });
  }

  /**
   * Called by an admin endpoint when a PENDING_APPROVAL case is approved.
   */
  async approveCase(caseId: string, approvedByUserId: string) {
    const kase = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    if (kase.status !== 'PENDING_APPROVAL') {
      throw new Error(`Case ${caseId} is not pending approval (status: ${kase.status}).`);
    }

    await this.logEvent(caseId, 'APPROVED_BY_ADMIN', { approvedByUserId });

    // Re-run diagnosis so we execute with a fresh decision, now under
    // an approved context. In a fuller version we'd re-use the stored
    // diagnosis rather than re-calling the AI — left as a next step.
    return this.diagnoseAndDecide(caseId);
  }

    /**
   * A scripted client response arrives for a case (manually triggered
   * for now; eventually called by synthetic batch data). This is the
   * branching logic: promise, dispute, partial payment, or "already paid".
   */
  async handleClientResponse(
    caseId: string,
    responseType: 'PROMISE_TO_PAY' | 'DISPUTE' | 'PARTIAL_PAYMENT' | 'ALREADY_PAID',
    payload: { promisedAmount?: number; promisedBySimDay?: number; partialAmount?: number },
  ) {
    const currentDay = this.simClock.getCurrentDay();

    await this.prisma.clientResponse.create({
      data: { caseId, responseType, simDay: currentDay, payload: payload ?? undefined },
    });
    await this.logEvent(caseId, 'CLIENT_RESPONSE_RECEIVED', { responseType, payload });

    switch (responseType) {
      case 'DISPUTE':
        await this.prisma.case.update({
          where: { id: caseId },
          data: { status: 'ESCALATED', riskLevel: 'HIGH' },
        });
        await this.logEvent(caseId, 'ESCALATED_DISPUTE');
        break;

      case 'PROMISE_TO_PAY': {
        const expected = await this.getExpectedAmount(caseId);
        await this.prisma.promise.create({
          data: {
            caseId,
            promisedAmount: payload.promisedAmount ?? expected,
            promisedBySimDay: payload.promisedBySimDay ?? currentDay + 3,
          },
        });
        await this.logEvent(caseId, 'PROMISE_LOGGED', payload);
        // Case stays ACTION_TAKEN — waiting on the sim clock to reach
        // the promised day, at which point advanceClockAndResolve()
        // checks whether it was actually paid.
        break;
      }

      case 'PARTIAL_PAYMENT': {
        const amount = payload.partialAmount ?? 0;
        await this.prisma.payment.create({
          data: { caseId, amount, simDay: currentDay },
        });
        await this.recomputeRecoveryStatus(caseId);
        break;
      }

      case 'ALREADY_PAID': {
        const expected = await this.getExpectedAmount(caseId);
        await this.prisma.payment.create({
          data: { caseId, amount: expected, simDay: currentDay },
        });
        await this.recomputeRecoveryStatus(caseId);
        break;
      }
    }

    return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  }

  /**
   * Advances the sim clock, then resolves every promise that came due:
   * fulfilled (enough payments recorded) -> RECOVERED/PARTIALLY_RECOVERED,
   * broken (nothing paid in time) -> ESCALATED. This is the "stopping
   * rules + compliant escalation" the buildathon brief asks for.
   */
  async advanceClockAndResolve(days: number) {
    const { fromDay, toDay, duePromises } = await this.simClock.advanceDays(days);

        for (const promise of duePromises) {
      // Keep the case's own simDay in sync with the global clock —
      // otherwise a future re-diagnosis would use stale day context.
      await this.prisma.case.update({
        where: { id: promise.caseId },
        data: { simDay: toDay },
      });

      const totalPaid = await this.getTotalPaid(promise.caseId);

      if (totalPaid >= Number(promise.promisedAmount)) {
        await this.prisma.promise.update({
          where: { id: promise.id },
          data: { fulfilled: true },
        });
        await this.logEvent(promise.caseId, 'PROMISE_FULFILLED', {
          promisedAmount: promise.promisedAmount,
          totalPaid,
        });
        await this.recomputeRecoveryStatus(promise.caseId);
      } else {
        await this.prisma.case.update({
          where: { id: promise.caseId },
          data: { status: 'ESCALATED', riskLevel: 'HIGH' },
        });
        await this.logEvent(promise.caseId, 'PROMISE_BROKEN', {
          promisedAmount: promise.promisedAmount,
          totalPaid,
          reason: 'Promised amount not received by promised day — escalated to human review.',
        });
      }
    }

    return { fromDay, toDay, resolvedCount: duePromises.length };
  }

  private async getExpectedAmount(caseId: string): Promise<number> {
    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { invoice: true, paymentAttempt: true },
    });
    return Number(kase.invoice?.invoiceAmount ?? kase.paymentAttempt?.originalAmount ?? 0);
  }

  private async getTotalPaid(caseId: string): Promise<number> {
    const payments = await this.prisma.payment.findMany({ where: { caseId } });
    return payments.reduce((sum, p) => sum + Number(p.amount), 0);
  }

    private async recomputeRecoveryStatus(caseId: string) {
    const kase = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const expected = await this.getExpectedAmount(caseId);
    const totalPaid = await this.getTotalPaid(caseId);

    const status = totalPaid >= expected ? 'RECOVERED' : 'PARTIALLY_RECOVERED';

    // Skip the write + audit entry if nothing actually changed — avoids
    // duplicate RECOVERY_STATUS_UPDATED events when multiple triggers
    // (e.g. a client response AND a resolved promise) land on an
    // already-settled case.
    if (kase.status === status) return;

    await this.prisma.case.update({ where: { id: caseId }, data: { status } });
    await this.logEvent(caseId, 'RECOVERY_STATUS_UPDATED', { expected, totalPaid, status });
  }

}
