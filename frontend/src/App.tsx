import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { RecoveryCases } from './pages/RecoveryCases';
import { CaseDetail } from './pages/CaseDetail';
import { Approvals } from './pages/Approvals';
import { AuditLog } from './pages/AuditLog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Reserved for future signup — currently redirects to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/overview" element={<Overview />} />
              <Route path="/cases" element={<RecoveryCases />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/audit-log" element={<AuditLog />} />
            </Route>
          </Route>

          {/* Unknown routes bounce to overview (logged in) or login */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
