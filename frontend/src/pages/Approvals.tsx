import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases, getCase, approveCase, type Case, type CaseDetail } from '../lib/api';
import { formatINR } from '../lib/format';
import { latestEvent, hasEvent } from '../lib/decision-trace';
import { useAuth } from '../lib/auth-context';
import { useSimClock } from '../lib/sim-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { TypeBadge } from '../components/TypeBadge';

interface PendingRow {
  summary: Case;
  detail: CaseDetail;
}

export function Approvals() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { refreshTrigger } = useSimClock();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getCases()
      .then((cases) => cases.filter((c) => c.status === 'PENDING_APPROVAL'))
      .then(async (pending) => {
        const details = await Promise.all(
          pending.map(async (c) => ({ summary: c, detail: await getCase(c.id) })),
        );
        setRows(details);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshTrigger]);

  const handleApprove = async (id: string) => {
    try {
      await approveCase(id);
      setRows((r) => r.filter((row) => row.summary.id !== id));
    } catch {
      /* silent */
    }
  };

  const reasonFor = (d: CaseDetail): string => {
    if (hasEvent(d.auditEvents, 'DISPUTE_FLAGGED_FOR_REVIEW')) {
      return 'Client disputed the charge';
    }
    const policyEvt = latestEvent(d.auditEvents, 'POLICY_DECISION');
    return policyEvt?.payload?.reason ?? 'Awaiting policy decision';
  };

  const amount = (d: CaseDetail) =>
    Number(d.invoice?.invoiceAmount ?? d.paymentAttempt?.originalAmount ?? 0);

  const entityName = (d: CaseDetail) =>
    d.type === 'B2B_RECEIVABLE'
      ? (d.invoice?.customerName ?? 'Unknown')
      : `#${d.id.slice(0, 8)}`;

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate">Loading approvals…</p>;
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold text-ink">Approvals</h1>
        <p className="mt-4 text-sm text-slate">No cases awaiting approval.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Approvals</h1>
      <div className="mt-4 space-y-3">
        {rows.map(({ summary, detail }) => (
          <Card key={summary.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <button
                onClick={() => nav(`/cases/${summary.id}`)}
                className="truncate font-medium text-ink hover:text-accent"
              >
                {entityName(detail)}
              </button>
              <div className="mt-1 flex items-center gap-2">
                <TypeBadge type={summary.type} />
                <span className="text-sm tabular-nums font-medium text-ink">
                  {formatINR(amount(detail))}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate">{reasonFor(detail)}</p>
            </div>
            {user?.role === 'ADMIN' && (
              <Button
                variant="primary"
                onClick={() => handleApprove(summary.id)}
                className="shrink-0"
              >
                Approve
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
