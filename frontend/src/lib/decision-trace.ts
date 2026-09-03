import type { CaseDetail as CaseDetailType } from './api';

// Find the most recent audit event of a given type. auditEvents is already
// ordered createdAt asc by the backend, so walk backwards.
export function latestEvent(
  events: CaseDetailType['auditEvents'],
  type: string,
): CaseDetailType['auditEvents'][number] | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].eventType === type) return events[i];
  }
  return null;
}

export function hasEvent(
  events: CaseDetailType['auditEvents'],
  type: string,
): boolean {
  return events.some((e) => e.eventType === type);
}
