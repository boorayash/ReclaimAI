import { Injectable } from '@nestjs/common';
import { Diagnosis, PolicyDecision } from './types/recovery.types';

// This is the "deterministic code controls money-moving actions" half
// of the AI/rules split. The AI (or fallback) recommends WHAT to do;
// this service decides WHETHER it's allowed to happen automatically,
// or needs a human. It never calls Groq, never touches the DB directly
// — pure functions over the inputs it's given, which makes it trivial
// to unit-test and easy to explain to a panel.

const HIGH_RISK_AMOUNT_THRESHOLD = 100_000; // ₹1,00,000 — tune as needed

@Injectable()
export class PolicyEngineService {
  /**
   * Decides if a recommended action can auto-execute, needs approval,
   * or must be blocked outright (e.g. retry limit exhausted).
   */
  evaluate(params: {
    diagnosis: Diagnosis;
    amount: number;
    attemptNumber: number;
    maxRetries: number;
    hasDispute: boolean;
  }): PolicyDecision {
    const { diagnosis, amount, attemptNumber, maxRetries, hasDispute } = params;

    // Rule 1: AI was unavailable — the fallback action itself never moves
    // money (NO_ACTION_AI_UNAVAILABLE), but high-value cases still get
    // flagged for human eyes rather than silently auto-closing.
    if (diagnosis.decidedBy === 'FALLBACK') {
      if (amount >= HIGH_RISK_AMOUNT_THRESHOLD) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: `AI unavailable on a high-value case (₹${amount.toLocaleString('en-IN')}) — flagging for human review rather than proceeding blind.`,
        };
      }
      return {
        allowed: true,
        requiresApproval: false,
        reason:
          'AI unavailable — using safe deterministic fallback action only (no autonomous money-moving decision).',
      };
    }

    // Rule 2: disputes always go to a human, never auto-executed.
    if (hasDispute) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Case has an active dispute — requires human review before any further action.',
      };
    }

    // Rule 3: retry/stopping limit — don't chase forever.
    if (attemptNumber > maxRetries) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Retry limit reached (${attemptNumber}/${maxRetries}) — stopping automated attempts, case will be marked UNRESOLVED or escalated.`,
      };
    }

    // Rule 4: high-value cases require human approval regardless of AI confidence.
    if (amount >= HIGH_RISK_AMOUNT_THRESHOLD) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Amount ₹${amount.toLocaleString('en-IN')} exceeds the ₹${HIGH_RISK_AMOUNT_THRESHOLD.toLocaleString('en-IN')} auto-execute threshold — requires ADMIN approval.`,
      };
    }

    // Rule 5: everything else — low risk, within retry budget, no dispute — auto-executes.
    return {
      allowed: true,
      requiresApproval: false,
      reason: `Low-risk action (₹${amount.toLocaleString('en-IN')}, attempt ${attemptNumber}/${maxRetries}) — auto-executing per policy.`,
    };
  }
}
