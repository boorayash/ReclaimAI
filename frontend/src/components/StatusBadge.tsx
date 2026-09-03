// One central status -> color map. Every page renders status through this
// so "recovered is always forest" is enforced once, not per page.
const STATUS_COLOR: Record<string, string> = {
  RECOVERED: 'var(--color-accent)',
  ESCALATED: 'var(--color-danger)',
  UNRESOLVED: 'var(--color-danger)',
  PENDING_APPROVAL: 'var(--color-warning)',
  DETECTED: 'var(--color-neutral)',
  DIAGNOSING: 'var(--color-neutral)',
  ACTION_TAKEN: 'var(--color-neutral)',
};

// PARTIALLY_RECOVERED gets a hollow ring (accent border, no fill) — visually
// distinct from solid-green RECOVERED. Conveys "partial / still open".
const PARTIAL_RING_STYLE = {
  backgroundColor: 'transparent',
  border: '2px solid var(--color-accent)',
} as const;

function sentenceCase(status: string): string {
  return status.toLowerCase().replace(/_/g, ' ');
}

export function StatusBadge({ status }: { status: string }) {
  const isPartial = status === 'PARTIALLY_RECOVERED';
  const color = STATUS_COLOR[status] ?? 'var(--color-neutral)';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={isPartial ? PARTIAL_RING_STYLE : { backgroundColor: color }}
      />
      {sentenceCase(status)}
    </span>
  );
}
