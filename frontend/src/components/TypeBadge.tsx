import type { CaseType } from '../lib/api';

// Both badge fills are SOLID tokens. No Tailwind `/NN` alpha modifiers here —
// they silently fail on var()-defined colors (config maps colors to bare
// `var(--color-*)` strings, no alpha slot), rendering full opacity.
// B2B = mint fill, PF = hairline fill.
export function TypeBadge({ type }: { type: CaseType }) {
  const cls =
    type === 'B2B_RECEIVABLE'
      ? 'bg-accent-muted text-accent'
      : 'bg-hairline text-slate';
  const label = type === 'B2B_RECEIVABLE' ? 'B2B' : 'Payment failure';
  return (
    <span className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}