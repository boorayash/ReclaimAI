import { StatusBadge } from '../components/StatusBadge';

// Temp status badge spot-check — remove in step 2
const DEMO_STATUSES = ['RECOVERED', 'PENDING_APPROVAL', 'ESCALATED', 'DIAGNOSING', 'UNRESOLVED'] as const;

export function Overview() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Overview</h1>
      <p className="mt-2 text-sm text-slate">Overview — coming in step 2.</p>
      <div className="mt-6 space-y-1 border border-hairline p-4">
        <p className="mb-2 text-xs text-slate">StatusBadge spot-check (to remove in step 2):</p>
        {DEMO_STATUSES.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
    </div>
  );
}
