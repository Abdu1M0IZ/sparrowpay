// 404 fallback page.

import { Link } from 'react-router-dom';
import { Bird } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="sp-shell">
      <div className="sp-frame d-flex flex-column align-items-center justify-content-center text-center p-4">
        <div style={{
          height: 80, width: 80, borderRadius: '50%',
          background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)',
        }}
          className="d-flex align-items-center justify-content-center mb-3"
        >
          <Bird size={40} color="var(--sp-primary)" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Page not found</h1>
        <div className="sp-text-muted mb-4">
          We couldn’t find the page you were looking for.
        </div>
        <Link className="sp-btn" to="/app/dashboard" style={{ width: 'auto', padding: '0.6rem 1rem' }}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
