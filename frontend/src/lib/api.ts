// Thin fetch wrapper: attaches JWT, redirects on 401, JSON in/out.
const BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'rr_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && window.location.pathname !== '/login') {
    setToken(null);
    window.location.assign('/login');
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { message?: string }).message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'REVIEWER';
}

// Plain fetch (not request()) — a failed login is 401 and must not redirect.
export async function login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { message?: string }).message ?? 'Login failed');
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

export type CaseType = 'B2B_RECEIVABLE' | 'PAYMENT_FAILURE';
export type CaseStatus =
  | 'DETECTED'
  | 'DIAGNOSING'
  | 'PENDING_APPROVAL'
  | 'ACTION_TAKEN'
  | 'RECOVERED'
  | 'PARTIALLY_RECOVERED'
  | 'ESCALATED'
  | 'UNRESOLVED';

export interface Case {
  id: string;
  type: CaseType;
  status: CaseStatus;
  riskLevel: 'LOW' | 'HIGH';
  simDay: number;
  createdAt: string;
  updatedAt: string;
  invoice: { customerName: string; invoiceAmount: number; dueSimDay: number } | null;
  paymentAttempt: {
    originalAmount: number;
    failureReason: string;
    retryCount: number;
    maxRetries: number;
    succeedsOnRetryAt: number | null;
  } | null;
}

export interface MetricsResponse {
  totalCases: number;
  recoveredCases: number;
  recoveredAmount: number;
  expectedAmount: number;
  moneyRecoveryRate: number;
  recoveryRate: number;
  byStatus: Record<string, number>;
  byType: Record<string, {
    totalCases: number;
    recoveredCases: number;
    recoveredAmount: number;
    recoveryRate: number;
  }>;
}

export interface TimeseriesPoint {
  simDay: number;
  cumulativeRecovered: number;
}

export const getMetrics = () => api.get<MetricsResponse>('/cases/metrics');
export const getMetricsTimeseries = () =>
  api.get<{ series: TimeseriesPoint[] }>('/cases/metrics/timeseries');
export const getCases = () => api.get<Case[]>('/cases');

export interface RecoveryAction {
  id: string;
  actionType: string;
  status: string;
  attemptNumber: number;
  decidedBy: string; // "AI" | "POLICY_ENGINE" | "FALLBACK"
  reasoning: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  payload: Record<string, any> | null;
  createdAt: string;
}

export interface Promise_ {
  id: string;
  promisedAmount: number;
  promisedBySimDay: number;
  fulfilled: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  simDay: number;
  createdAt: string;
}

export interface CaseDetail extends Case {
  recoveryActions: RecoveryAction[];
  auditEvents: AuditEvent[];
  promises: Promise_[];
  payments: Payment[];
}

export const getCase = (id: string) => api.get<CaseDetail>(`/cases/${id}`);
export const processCase = (id: string) =>
  api.post<CaseDetail>(`/cases/${id}/process`, {});
