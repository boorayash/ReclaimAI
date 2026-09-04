import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases, type Case, type CaseType } from '../lib/api';
import { formatINR, overdueDetail } from '../lib/format';
import { useSimClock } from '../lib/sim-context';
import { Table, type Column } from '../components/Table';
import { TypeBadge } from '../components/TypeBadge';
import { StatusBadge } from '../components/StatusBadge';

type Tab = 'ALL' | CaseType;
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'B2B_RECEIVABLE', label: 'B2B receivables' },
  { key: 'PAYMENT_FAILURE', label: 'Payment failures' },
];

export function RecoveryCases() {
  const nav = useNavigate();
  const { refreshTrigger, currentDay } = useSimClock();
  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<Tab>('ALL');

  useEffect(() => {
    getCases().then(setCases).catch(() => {});
  }, [refreshTrigger]);

  const rows = useMemo(
    () => (tab === 'ALL' ? cases : cases.filter((c) => c.type === tab)),
    [cases, tab],
  );

  const columns: Column<Case>[] = [
    {
      key: 'entity',
      header: 'Case',
      render: (row: Case) => (
        <span className="font-medium text-ink">
          {row.invoice?.customerName ?? `#${row.id.slice(0, 8)}`}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (row: Case) => <TypeBadge type={row.type} /> },
    { key: 'status', header: 'Status', render: (row: Case) => <StatusBadge status={row.status} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row: Case) =>
        formatINR(Number(row.invoice?.invoiceAmount ?? row.paymentAttempt?.originalAmount ?? 0)),
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (row: Case) =>
        row.type === 'B2B_RECEIVABLE' ? (
          overdueDetail(row, currentDay)
        ) : (
          <span>
            {row.paymentAttempt?.failureReason ?? ''}
            <span className="ml-1 text-slate">
              · {row.paymentAttempt?.retryCount ?? 0}/{row.paymentAttempt?.maxRetries ?? 3} retries
            </span>
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Recovery cases</h1>
      </div>

      {/* Filter tabs — no pill chrome, underline active tab */}
      <div className="mt-4 flex gap-5 border-b border-hairline">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 pb-2 text-sm ${
                active
                  ? 'border-accent font-medium text-ink'
                  : 'border-transparent text-slate hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Table
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => nav(`/cases/${row.id}`)}
          emptyMessage="No cases match this filter."
        />
      </div>
    </div>
  );
}