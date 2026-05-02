// Support page - basic info card and a contact stub.

import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, ChevronLeft } from 'lucide-react';

export default function SupportPage() {
  const navigate = useNavigate();
  return (
    <div className="sp-page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Support</h1>

      <div className="sp-card mt-3">
        <div className="d-flex align-items-center" style={{ gap: '0.5rem' }}>
          <ShieldCheck size={18} color="var(--sp-primary)" />
          <div style={{ fontWeight: 600 }}>Security help</div>
        </div>
        <div className="sp-text-muted mt-2">
          For account issues, password or PIN recovery, or to report suspicious activity, please reach out using the contact channels below. Never share your password or PIN with anyone.
        </div>
        <div className="sp-card mt-3" style={{ background: '#F9FAFB' }}>
          <div className="d-flex align-items-center" style={{ gap: '0.5rem' }}>
            <Mail size={16} />
            <div className="sp-text-muted">support@sparrowpay.local</div>
          </div>
        </div>
      </div>

      <div className="sp-card mt-3">
        <div style={{ fontWeight: 600 }}>FAQ</div>
        <ul className="mt-2 ps-3 sp-text-muted" style={{ listStyle: 'disc' }}>
          <li>Forgot password? Use Forgot Password from the sign-in screen with your PIN.</li>
          <li>Forgot PIN? Use the Forgot PIN page from your Account; verify with your password.</li>
          <li>Need to update your phone? Edit your profile from the Account page.</li>
        </ul>
      </div>

      <button className="sp-btn sp-btn-ghost mt-3" onClick={() => navigate('/app/account')}>
        <ChevronLeft size={14} /> Back to Account
      </button>
    </div>
  );
}
