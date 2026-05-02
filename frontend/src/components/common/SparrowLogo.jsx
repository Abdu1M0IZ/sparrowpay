import { Bird } from 'lucide-react';

export default function SparrowLogo({ invert = false }) {
  return (
    <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
      <div
        className="d-flex align-items-center justify-content-center"
        style={{
          height: 40, width: 40, borderRadius: 16,
          background: invert ? 'rgba(255,255,255,0.15)' : 'var(--sp-purple-100)',
          border: `1px solid ${invert ? 'rgba(255,255,255,0.2)' : 'var(--sp-purple-200)'}`,
        }}
      >
        <Bird size={20} color={invert ? '#ffffff' : 'var(--sp-primary)'} />
      </div>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: invert ? '#fff' : 'var(--sp-text)' }}>
          SparrowPay
        </div>
        <div style={{ fontSize: '0.7rem', color: invert ? 'rgba(255,255,255,0.7)' : 'var(--sp-muted)' }}>
          Banking • Sparrows • Privacy
        </div>
      </div>
    </div>
  );
}
