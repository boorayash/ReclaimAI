// Shared shapes passed between the AI diagnosis layer, the policy
// engine, and the orchestrator. Keeping these as plain types (not
// classes) makes it easy to log them wholesale into AuditEvent.payload.

export type Diagnosis = {
  // what the AI (or fallback logic) believes is going on
  classification: string; // e.g. "REPEAT_PAYMENT_FAILURE", "FIRST_TIME_LATE_INVOICE"
  recommendedAction:
    | 'RETRY_PAYMENT'
    | 'SEND_REMINDER'
    | 'SEND_ESCALATION'
    | 'REQUEST_COMMITMENT'
    | 'VERIFY_PAYMENT'
    | 'ESCALATE_TO_HUMAN'
    | 'NO_ACTION_AI_UNAVAILABLE';
  reasoning: string;
  confidence: number; // 0-1, used only for logging/explainability, not decision logic
  decidedBy: 'AI' | 'FALLBACK';
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string; // always populated — this is what shows in the audit trail
};
