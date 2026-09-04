import type { Case } from './api';

// INR money formatting, no decimals. Native Intl — no currency lib.
export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

// recoveryRate is a fraction 0..1. 0.437 -> "44%".
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// Positive overdue = past due ("Nd overdue"); non-positive = countdown.
// Shared by RecoveryCases and CaseDetail.
// Takes live currentDay — never reads per-case simDay snapshot.
export function overdueDetail(row: Case, currentDay: number): string {
  const inv = row.invoice;
  if (!inv) return '';
  const overdue = currentDay - inv.dueSimDay;
  return overdue > 0 ? `${overdue}d overdue` : `due in ${-overdue}d`;
}