export default function Pill({ active, children, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`sp-pill ${active ? 'sp-pill-active' : ''}`}
    >
      {children}
    </button>
  );
}
