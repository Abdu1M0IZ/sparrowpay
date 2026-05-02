// AuthLayout - phone-frame wrapper with the gradient/mist background used
// by login, signup, and forgot-password pages.

import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import SparrowMist from '../components/common/SparrowMist.jsx';
import SparrowLogo from '../components/common/SparrowLogo.jsx';

export default function AuthLayout() {
  const { authed, loading } = useAuth();
  if (loading) {
    return (
      <div className="sp-shell">
        <div className="sp-frame d-flex align-items-center justify-content-center">
          <div className="sp-text-muted">Loading…</div>
        </div>
      </div>
    );
  }
  if (authed) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="sp-shell">
      <div className="sp-frame">
        <div className="position-absolute top-0 start-0 end-0 bottom-0">
          <div className="sp-auth-bg" />
          <div className="position-absolute top-0 start-0 end-0 bottom-0">
            <SparrowMist />
          </div>
          <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex flex-column p-4">
            <div className="mt-4 mt-sm-5">
              <SparrowLogo invert />
            </div>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
