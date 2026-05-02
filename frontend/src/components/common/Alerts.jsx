// Small reusable alert components used across forms.

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export function ErrorAlert({ children }) {
  if (!children) return null;
  return (
    <div className="sp-alert sp-alert-error d-flex align-items-start" style={{ gap: '0.5rem' }} role="alert">
      <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}

export function SuccessAlert({ children }) {
  if (!children) return null;
  return (
    <div className="sp-alert sp-alert-success d-flex align-items-start" style={{ gap: '0.5rem' }} role="status">
      <CheckCircle2 size={16} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}

export function WarnAlert({ children }) {
  if (!children) return null;
  return (
    <div className="sp-alert sp-alert-warn d-flex align-items-start" style={{ gap: '0.5rem' }} role="alert">
      <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}
