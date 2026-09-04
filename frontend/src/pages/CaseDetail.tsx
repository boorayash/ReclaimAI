import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCase, processCase, type CaseDetail as CaseDetailType } from '../lib/api';
import { formatINR, overdueDetail } from '../lib/format';
import { humanize, EVENT_LABELS, ACTION_LABELS } from '../lib/labels';
import { latestEvent } from '../lib/decision-trace';
import { useSimClock } from '../lib/sim-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { TypeBadge } from '../components/TypeBadge';

// Statuses where re-trigger is disabled
const TERMINAL = ['RECOVERED', 'PARTIALLY_RECOVERED', 'UNRESOLVED', 'ESCALATED'];

// Plain-language summary for each Decision Trace stage
function diagnosisSummary(evt: ReturnType<typeof latestEvent>) {
  if (!evt?.payload) return null;
  const p = evt.payload;
  return `${p.classification ?? 'Unknown'} — ${p.reasoning ?? ''}`.trim();
}

function policySummary(evt: ReturnType<typeof latestEvent>) {
  if (!evt?.payload) return null;
  const p = evt.payload;
  const verdict = p.allowed ? 'Approved' : 'Blocked';
  return `${verdict}: ${p.reason ?? ''}`.trim();
}

function authorizationSummary(
  policyEvt: ReturnType<typeof latestEvent>,
  approvalEvt: ReturnType<typeof latestEvent>,
) {
  // policyEvt null = not yet evaluated -> let TraceStage show pending state.
  if (!policyEvt) return null;
  if (!policyEvt.payload?.requiresApproval) {
    return 'Not required — auto-executed under policy';
  }
  if (approvalEvt) {
    return 'Approved by admin';
  }
  return 'Awaiting approval';
}

function actionSummary(evt: ReturnType<typeof latestEvent>) {
  if (!evt) return null;
  const p = evt.payload;
  const action = humanize(p?.action ?? '', ACTION_LABELS);
  return action || null;
}

function outcomeSummary(status: string) {
  switch (status) {
    case 'RECOVERED':
      return 'Fully recovered';
    case 'PARTIALLY_RECOVERED':
      return 'Partially recovered — case still open';
    case 'ESCALATED':
      return 'Escalated to human review';
    case 'UNRESOLVED':
      return 'Closed — unresolved';
    case 'PENDING_APPROVAL':
      return 'Awaiting admin approval';
    case 'ACTION_TAKEN':
      return 'Action executed — awaiting outcome';
    case 'DIAGNOSING':
      return 'Diagnosis in progress';
    case 'DETECTED':
      return 'Detected — not yet processed';
    default:
      return status;
  }
}

// Audit event payload detail line (type-specific)
function eventDetail(evt: CaseDetailType['auditEvents'][number]) {
  const p = evt.payload;
  if (!p) return null;
  switch (evt.eventType) {
    case 'POLICY_DECISION':
      return p.reason ?? null;
    case 'PROMISE_LOGGED':
      return `₹${Number(p.promisedAmount).toLocaleString('en-IN')} due sim day ${p.promisedBySimDay}`;
    case 'RETRY_RECOVERED':
      return `Attempt ${p.attempt} — ₹${Number(p.recoveredAmount).toLocaleString('en-IN')} recovered`;
    case 'ACTION_EXECUTED':
      return humanize(p.action ?? '', ACTION_LABELS);
    case 'CASE_CLOSED_UNRESOLVED':
      return p.reason ?? null;
    case 'CLIENT_RESPONSE_RECEIVED':
      return p.responseType ?? null;
    case 'RECOVERY_STATUS_UPDATED':
      return p.status ?? null;
    case 'APPROVED_BY_ADMIN':
      return null; // label alone is clear
    case 'DIAGNOSIS_COMPLETE':
      return p.classification ?? null;
    default:
      return null;
  }
}

// Decision Trace stage component
function TraceStage({
  label,
  summary,
  status, // 'done' | 'pending' | 'blocked'
}: {
  label: string;
  summary: string | null;
  status: 'done' | 'pending' | 'blocked';
}) {
  const dotColor =
    status === 'done'
      ? 'bg-accent'
      : status === 'blocked'
        ? 'bg-danger'
        : 'bg-neutral';
  return (
    <div className="flex gap-3">
      {/* Vertical connector */}
      <div className="flex flex-col items-center">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
        <span className="w-px flex-1 bg-hairline" />
      </div>
      {/* Content */}
      <div className="pb-6">
        <p className="text-sm font-medium text-ink">{label}</p>
        {summary ? (
          <p className="mt-0.5 text-sm text-slate">{summary}</p>
        ) : (
          <p className="mt-0.5 text-sm italic text-neutral">Not yet available</p>
        )}
      </div>
    </div>
  );
}

export function CaseDetail() {
  const { id } = useParams();
  const { refreshTrigger, currentDay } = useSimClock();
  const [data, setData] = useState<CaseDetailType | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    getCase(id)
      .then(setData)
      .catch(() => setError('Failed to load case.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id, refreshTrigger]);

  const handleProcess = () => {
    if (!id) return;
    setProcessing(true);
    setError('');
    processCase(id)
      .then(() => load())
      .catch(() => setError('Re-trigger failed.'))
      .finally(() => setProcessing(false));
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate">Loading case…</div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-danger">
        {error || 'Case not found.'}
      </div>
    );
  }

  // Entity name
  const entityName =
    data.type === 'B2B_RECEIVABLE'
      ? (data.invoice?.customerName ?? 'Unknown')
      : `#${data.id.slice(0, 8)}`;

  // Amount
  const amount = Number(
    data.invoice?.invoiceAmount ?? data.paymentAttempt?.originalAmount ?? 0,
  );

  // Decision Trace stage data
  const diagEvt = latestEvent(data.auditEvents, 'DIAGNOSIS_COMPLETE');
  const policyEvt = latestEvent(data.auditEvents, 'POLICY_DECISION');
  const approvalEvt = latestEvent(data.auditEvents, 'APPROVED_BY_ADMIN');
  const actionEvt = latestEvent(data.auditEvents, 'ACTION_EXECUTED');

  // Re-trigger enabled only for in-process statuses
  const canRetrigger =
    !!data.status &&
    !TERMINAL.includes(data.status) &&
    data.status !== 'PENDING_APPROVAL';

  return (
    <div>
      {/* Back link */}
      <Link to="/cases" className="text-sm text-slate hover:text-ink">
        ← Back to cases
      </Link>

      {/* Header */}
      <div className="mt-4">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          {entityName}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <TypeBadge type={data.type} />
          <StatusBadge status={data.status} />
        </div>
        <p className="mt-3 font-serif text-3xl font-semibold text-ink tabular-nums">
          {formatINR(amount)}
        </p>
        <p className="mt-1 text-sm text-slate">
          {data.type === 'B2B_RECEIVABLE'
            ? overdueDetail(data, currentDay)
            : `${data.paymentAttempt?.failureReason ?? ''} · ${data.paymentAttempt?.retryCount ?? 0}/${data.paymentAttempt?.maxRetries ?? 3} retries`}
        </p>
      </div>

      {/* Decision Trace */}
      <Card className="mt-6">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Decision trace
        </h2>
        <div className="mt-4">
          <TraceStage
            label="AI diagnosis"
            summary={diagnosisSummary(diagEvt)}
            status={diagEvt ? 'done' : 'pending'}
          />
          <TraceStage
            label="Policy evaluation"
            summary={policySummary(policyEvt)}
            status={
              !policyEvt ? 'pending' : policyEvt.payload?.allowed === false ? 'blocked' : 'done'
            }
          />
          <TraceStage
            label="Authorization"
            summary={authorizationSummary(policyEvt, approvalEvt)}
            status={
              !policyEvt
                ? 'pending'
                : policyEvt.payload?.requiresApproval
                  ? approvalEvt
                    ? 'done'
                    : 'pending'
                  : 'done'
            }
          />
          <TraceStage
            label="Action execution"
            summary={actionSummary(actionEvt)}
            status={actionEvt ? 'done' : 'pending'}
          />
          <TraceStage
            label="Outcome"
            summary={outcomeSummary(data.status)}
            status={
              TERMINAL.includes(data.status)
                ? data.status === 'RECOVERED' || data.status === 'PARTIALLY_RECOVERED'
                  ? 'done'
                  : 'blocked'
                : 'pending'
            }
          />
        </div>
      </Card>

      {/* Audit timeline */}
      {data.auditEvents.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Audit timeline
          </h2>
          <div className="mt-4 space-y-3">
            {data.auditEvents.map((evt) => (
              <div key={evt.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {humanize(evt.eventType, EVENT_LABELS)}
                  </p>
                  {eventDetail(evt) && (
                    <p className="mt-0.5 text-sm text-slate">{eventDetail(evt)}</p>
                  )}
                  <p className="mt-0.5 text-xs text-neutral">
                    {new Date(evt.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Promises & Payments */}
      {(data.promises.length > 0 || data.payments.length > 0) && (
        <Card className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Promises & payments
          </h2>
          {data.promises.length > 0 && (
            <div className="mt-3 space-y-2">
              {data.promises.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    ₹{Number(pr.promisedAmount).toLocaleString('en-IN')} due sim day {pr.promisedBySimDay}
                  </span>
                  <span className={pr.fulfilled ? 'text-accent' : 'text-warning'}>
                    {pr.fulfilled ? 'Fulfilled' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data.payments.length > 0 && (
            <div className="mt-3 space-y-2">
              {data.payments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    ₹{Number(pay.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-slate">Sim day {pay.simDay}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Re-trigger */}
      <div className="mt-6">
        <Button
          onClick={handleProcess}
          disabled={!canRetrigger || processing}
        >
          {processing ? 'Re-running…' : 'Re-run diagnosis'}
        </Button>
        {error && (
          <p className="mt-2 text-sm text-danger">{error}</p>
        )}
      </div>
    </div>
  );
}
