import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuditLog, type AuditLogResponse } from '../lib/api';
import { humanize, EVENT_LABELS } from '../lib/labels';
import { Table } from '../components/Table';
import { TypeBadge } from '../components/TypeBadge';

const FILTERS = [{ key: '', label: 'All events' }].concat(
  Object.keys(EVENT_LABELS).map((key) => ({ key, label: humanize(key, EVENT_LABELS) })),
);

export function AuditLog() {
  const nav = useNavigate();
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');

  useEffect(() => {
    getAuditLog({ page, ...(eventType ? { eventType } : {}) })
      .then(setData)
      .catch(() => setData(null));
  }, [page, eventType]);

  const columns = useMemo(
    () => [
      {
        key: 'when',
        header: 'Timestamp',
        render: (row: { createdAt: string }) =>
          new Date(row.createdAt).toLocaleString('en-IN'),
      },
      {
        key: 'event',
        header: 'Event',
        render: (row: { eventType: string }) =>
          humanize(row.eventType, EVENT_LABELS),
      },
      {
        key: 'case',
        header: 'Case',
        render: (row: { caseLabel: string }) => (
          <span className="font-medium text-ink">{row.caseLabel}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (row: { caseType: 'B2B_RECEIVABLE' | 'PAYMENT_FAILURE' }) => (
          <TypeBadge type={row.caseType} />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Audit log</h1>
        <select
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setPage(1);
          }}
          className="rounded-sm border border-hairline bg-surface px-3 py-1.5 text-sm text-ink"
        >
          {FILTERS.map((f) => (
            <option key={f.key || '__all'} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => nav(`/cases/${row.caseId}`)}
          emptyMessage="No audit events."
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate">
        <span>
          Page {data?.page ?? 1} of {data?.totalPages ?? 1}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data || data.page <= 1}
            className="rounded-sm border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data || data.page >= data.totalPages}
            className="rounded-sm border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
