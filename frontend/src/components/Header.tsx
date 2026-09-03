import { useState } from 'react';
import { useSimClock } from '../lib/sim-context';
import { getMetrics } from '../lib/api';
import { formatINR } from '../lib/format';
import { Button } from './Button';

const FORWARD = [
  { days: 1, label: '+1 day' },
  { days: 3, label: '+3 days' },
  { days: 7, label: '+7 days' },
];

export function Header() {
  const { currentDay, advance } = useSimClock();
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<string>('');
  const [toastKey, setToastKey] = useState(0);

  const handleAdvance = async (days: number) => {
    setBusy(days);
    try {
      const before = await getMetrics().catch(() => null);
      const res = await advance(days);
      const after = await getMetrics().catch(() => null);

      const delta = after && before ? after.recoveredAmount - before.recoveredAmount : 0;

      const parts: string[] = [`Advanced to sim day ${res.toDay}`];
      if (res.resolvedCount > 0) parts.push(`${res.resolvedCount} promise${res.resolvedCount === 1 ? '' : 's'} resolved`);
      if (res.noResponseEscalated > 0) parts.push(`${res.noResponseEscalated} escalated`);
      if (delta > 0) parts.push(`${formatINR(delta)} recovered`);

      setToast(parts.join(' · '));
      setToastKey((k) => k + 1);
      setTimeout(() => setToast(''), 5000);
    } catch {
      setToast('Advance failed');
      setToastKey((k) => k + 1);
      setTimeout(() => setToast(''), 5000);
    } finally {
      setBusy(null);
    }
  };

  return (
    <header className="relative flex items-center justify-between border-b border-hairline bg-surface px-5 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate">Sim day</span>
        <span className="text-sm tabular-nums font-medium text-ink">{currentDay}</span>
        {FORWARD.map(({ days, label }) => (
          <Button
            key={days}
            variant="secondary"
            disabled={busy !== null}
            onClick={() => handleAdvance(days)}
          >
            {busy === days ? 'Advancing…' : label}
          </Button>
        ))}
      </div>

      {toast && (
        <div
          key={toastKey}
          className="absolute right-5 top-full z-30 mt-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-xs text-ink shadow-md"
        >
          {toast}
        </div>
      )}
    </header>
  );
}
