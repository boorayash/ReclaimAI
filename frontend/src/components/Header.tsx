import { Button } from './Button';

// Header owns sim-day only — no user/profile/logout.
export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-hairline bg-surface px-5 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate">Sim day</span>
        <span className="text-sm tabular-nums font-medium text-ink">—</span>
        <Button variant="secondary" disabled>
          −1 day
        </Button>
        <Button variant="secondary" disabled>
          +1 day
        </Button>
      </div>
    </header>
  );
}
