// Shared formatting and parsing helpers extracted from the original App.jsx.

export const PK_PHONE_RE = /^03\d{2}-\d{7}$/;
export const PK_CNIC_RE = /^\d{5}-\d{7}-\d{1}$/;

export function formatPkPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4, 11)}`;
}

export function formatPkCnic(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5, 12)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

export function parseAmount(raw) {
  const cleaned = String(raw || '').replace(/,/g, '').replace(/[^0-9.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatCompactPKR(n) {
  const x = Number(n || 0);
  const abs = Math.abs(x);
  if (abs <= 9999) return x.toLocaleString();

  if (abs < 1_000_000) {
    const v = abs / 1000;
    const shown = v < 100 ? v.toFixed(1) : Math.round(v).toString();
    return `${x < 0 ? '-' : ''}${shown.replace(/\.0$/, '')}k+`;
  }

  const v = abs / 1_000_000;
  const shown = v < 100 ? v.toFixed(1) : Math.round(v).toString();
  return `${x < 0 ? '-' : ''}${shown.replace(/\.0$/, '')}M+`;
}

export function formatPKR(n) {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}
