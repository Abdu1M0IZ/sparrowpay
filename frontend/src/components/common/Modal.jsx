// Bottom-sheet modal used throughout the app.

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="sp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{title}</div>
          <div style={{ height: 6, width: 48, borderRadius: 3, background: '#E5E7EB' }} />
        </div>
        {children}
      </div>
    </div>
  );
}
