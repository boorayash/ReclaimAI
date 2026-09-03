// One central status -> color map. Every page renders status through this
// so "recovered is always forest" is enforced once, not per page.
const STATUS_COLOR: Record<string, string> = {
  RECOVERED: 'var(--color-accent)',
  PARTIALLY_RECOVERED: 'var(--color-accent)',
  ESCALATED: 'var(--color-danger)',
  UNRESOLVED: 'var(--color-danger)',
  PENDING_APPROVAL: 'var(--color-warning)',
  DETECTED: 'var(--color-neutral)',
  DIAGNOSING: 'var(--color-neutral)',
  ACTION_TAKEN: 'var(--color-neutral)',
};

function sentenceCase(status: string): string {
  return status.toLowerCase().replace(/_/g, ' ');
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? 'var(--color-neutral)';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {sentenceCase(status)}
    </span>
  );
}
