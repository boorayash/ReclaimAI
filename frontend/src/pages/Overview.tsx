import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  getMetrics,
  getMetricsTimeseries,
  getCases,
  type MetricsResponse,
  type TimeseriesPoint,
  type Case,
} from '../lib/api';
import { formatINR, formatPercent } from '../lib/format';
import { Card } from '../components/Card';
import { Table } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { TypeBadge } from '../components/TypeBadge';

// In-flight statuses (not concluded). Summed for the Active KPI.
const ACTIVE_STATUSES = ['DETECTED', 'DIAGNOSING', 'ACTION_TAKEN', 'PENDING_APPROVAL', 'PARTIALLY_RECOVERED'];
const CHART_HEIGHT = 288;

export function Overview() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => {});
    getMetricsTimeseries().then((r) => setSeries(r.series)).catch(() => {});
    getCases().then(setCases).catch(() => {});
  }, []);

  const activeCases = ACTIVE_STATUSES.reduce(
    (sum, s) => sum + (metrics?.byStatus[s] ?? 0),
    0,
  );
  const byType = metrics?.byType ?? {};
  const b2b = byType['B2B_RECEIVABLE'] ?? { totalCases: 0, recoveredCases: 0, recoveredAmount: 0, recoveryRate: 0 };
  const pf = byType['PAYMENT_FAILURE'] ?? { totalCases: 0, recoveredCases: 0, recoveredAmount: 0, recoveryRate: 0 };

  // KPI value rendering: Recovered + Recovery rate get Fraunces big-figure
  // treatment (only sanctioned place for serif numbers); rest are sans.
  const kpi = (label: string, value: string, serif = false) => (
    <Card key={label}>
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className={`mt-2 truncate ${serif ? 'font-serif text-3xl font-semibold' : 'text-2xl font-medium'} text-ink tabular-nums`}>
        {value}
      </p>
    </Card>
  );

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Overview</h1>

      {/* KPI row */}
      {metrics && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {kpi('At risk', formatINR(metrics.expectedAmount))}
          {kpi('Recovered', formatINR(metrics.recoveredAmount), true)}
          {kpi('Recovery rate', formatPercent(metrics.recoveryRate), true)}
          {kpi('Active cases', String(activeCases))}
          {kpi('Escalated', String(metrics.byStatus.ESCALATED ?? 0))}
          {kpi('Unresolved', String(metrics.byStatus.UNRESOLVED ?? 0))}
        </div>
      )}

      {/* Type breakdown */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">B2B receivables</h2>
            <TypeBadge type="B2B_RECEIVABLE" />
          </div>
          <p className="mt-3 text-sm text-slate">
            <span className="tabular-nums">{b2b.totalCases}</span> cases ·{' '}
            <span className="tabular-nums">{formatINR(Number(b2b.recoveredAmount))}</span> recovered ·{' '}
            <span className="tabular-nums">{formatPercent(b2b.recoveryRate)}</span> rate
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">Payment failures</h2>
            <TypeBadge type="PAYMENT_FAILURE" />
          </div>
          <p className="mt-3 text-sm text-slate">
            <span className="tabular-nums">{pf.totalCases}</span> cases ·{' '}
            <span className="tabular-nums">{formatINR(Number(pf.recoveredAmount))}</span> recovered ·{' '}
            <span className="tabular-nums">{formatPercent(pf.recoveryRate)}</span> rate
          </p>
        </Card>
      </div>

      {/* Recovery over time */}
      <Card className="mt-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Recovery over time</h2>
        {series.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate">No recoveries yet this cycle</p>
        ) : (
          <div style={{ height: CHART_HEIGHT }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="simDay"
                  tick={{ fill: 'var(--color-slate)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-hairline)' }}
                  label={{ value: 'Sim day', position: 'insideBottomRight', offset: -4, fill: 'var(--color-slate)', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: 'var(--color-slate)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v: number) => formatINR(v)}
                />
                <Tooltip
                  contentStyle={{
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 4,
                    background: 'var(--color-surface)',
                  }}
                  labelStyle={{ color: 'var(--color-slate)' }}
                  formatter={(value: number | string) => [formatINR(Number(value)), 'Recovered']}
                  labelFormatter={(label) => `Sim day ${label}`}
                  cursor={{ stroke: 'var(--color-hairline)' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeRecovered"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Recent cases */}
      <Card className="mt-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Recent cases</h2>
        <div className="mt-3">
          <Table
            columns={[
              {
                key: 'entity',
                header: 'Case',
                render: (row: Case) => (
                  <Link to={`/cases/${row.id}`} className="hover:text-accent">
                    {row.invoice?.customerName ?? `#${row.id.slice(0, 8)}`}
                  </Link>
                ),
              },
              { key: 'type', header: 'Type', render: (row: Case) => <TypeBadge type={row.type} /> },
              { key: 'status', header: 'Status', render: (row: Case) => <StatusBadge status={row.status} /> },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (row: Case) => formatINR(Number(row.invoice?.invoiceAmount ?? row.paymentAttempt?.originalAmount ?? 0)),
              },
            ]}
            rows={cases.slice(0, 6)}
            rowKey={(row) => row.id}
            emptyMessage="No cases yet."
          />
        </div>
      </Card>
    </div>
  );
}