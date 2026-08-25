import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiDiagnosisService } from './ai-diagnosis.service';
import { PolicyEngineService } from './policy-engine.service';

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
        this.logger.log(`Case ${caseId} already has an action in flight — awaiting outcome.`);
        return kase;
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
    // actually has real data to act on next time this case is processed.
    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { paymentAttempt: true },
    });
    if (kase.paymentAttempt) {
      await this.prisma.paymentAttempt.update({
        where: { caseId },
        data: { retryCount: { increment: 1 } },
      });
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
}
