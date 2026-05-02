// Gates routes behind authentication. Unauthenticated users are redirected
// to /login while preserving the originally-requested location so we can
// bounce back after a successful login.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function ProtectedRoute({ children }) {
  const { authed, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="sp-shell">
        <div className="sp-frame d-flex align-items-center justify-content-center">
          <div className="sp-text-muted">Loading…</div>
        </div>
      </div>
    );
  }
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
