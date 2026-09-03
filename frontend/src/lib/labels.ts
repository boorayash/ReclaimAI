export const EVENT_LABELS: Record<string, string> = {
  DIAGNOSIS_STARTED: 'Diagnosis started',
  DIAGNOSIS_COMPLETE: 'AI diagnosis complete',
  POLICY_DECISION: 'Policy evaluated',
  ACTION_EXECUTED: 'Action executed',
  CLIENT_RESPONSE_RECEIVED: 'Client response received',
  PROMISE_LOGGED: 'Promise to pay logged',
  PROMISE_FULFILLED: 'Promise fulfilled',
  PROMISE_BROKEN: 'Promise broken',
  DISPUTE_FLAGGED_FOR_REVIEW: 'Dispute flagged for review',
  NO_RESPONSE_ESCALATED: 'Escalated — no response',
  RETRY_RECOVERED: 'Retry recovered payment',
  CASE_CLOSED_UNRESOLVED: 'Case closed — unresolved',
  APPROVED_BY_ADMIN: 'Approved by admin',
  RECOVERY_STATUS_UPDATED: 'Recovery status updated',
};

export const ACTION_LABELS: Record<string, string> = {
  RETRY_PAYMENT: 'Retry payment',
  SEND_REMINDER: 'Send reminder',
  SEND_ESCALATION: 'Send escalation',
  REQUEST_COMMITMENT: 'Request commitment',
  VERIFY_PAYMENT: 'Verify payment',
  ESCALATE_TO_HUMAN: 'Escalate to human',
  NO_ACTION_AI_UNAVAILABLE: 'No action — AI unavailable',
};

// Fallback: never show raw SCREAMING_SNAKE_CASE to the user.
export function humanize(key: string, map: Record<string, string>): string {
  return map[key] ?? key.toLowerCase().replace(/_/g, ' ');
}
