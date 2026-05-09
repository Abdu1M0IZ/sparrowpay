// Single transaction detail page (URL: /app/history/:transactionId).

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bird, ArrowUp, Copy, Check, Share2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { getTransaction } from '../services/transactionApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function TransactionDetailPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [tx, setTx] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const data = await getTransaction(transactionId);
        if (!cancelled) setTx(data);
      } catch (e) {
        if (!cancelled) setError(errorToMessage(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [transactionId]);

  function copyId() {
    if (!tx?.id) return;
    navigator?.clipboard?.writeText?.(tx.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  // Use the Web Share API where available (mobile / modern browsers); fall back
  // to copying a human-readable summary to the clipboard.
  async function onShare() {
    if (!tx) return;
    const isReceived = String(tx.status || '').toLowerCase() === 'received';
    const meName = me?.fullName || me?.full_name || me?.username || 'You';
    const fromName = isReceived ? tx.to : meName;
    const toName = isReceived ? meName : tx.to;
    const summary =
      `SparrowPay ${tx.kind === 'donation' ? 'donation' : 'transfer'} of ` +
      `Rs ${Number(tx.amount).toLocaleString()} from ${fromName} to ${toName} ` +
      `(${tx.bank_type}). Sparrow ID: ${tx.id}`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator?.share) {
        await navigator.share({ title: 'SparrowPay', text: summary, url });
        setShareMsg('Shared.');
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${summary}\n${url}`);
        setShareMsg('Copied to clipboard.');
      } else {
        setShareMsg('Sharing is not supported in this browser.');
      }
    } catch (e) {
      // AbortError fires if the user dismisses the native share sheet; ignore it.
      if (e?.name !== 'AbortError') {
        setShareMsg('Could not share. Please copy manually.');
      }
    } finally {
      setTimeout(() => setShareMsg(''), 1400);
    }
  }

  if (error) {
    return (
      <div className="sp-page">
        <ErrorAlert>{error}</ErrorAlert>
        <button className="sp-btn sp-btn-ghost mt-3" onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  if (!tx) {
    return <div className="sp-page sp-text-muted">Loading…</div>;
  }

  const created = new Date(tx.created_at || tx.createdAt || Date.now());
  const isReceived = String(tx.status || '').toLowerCase() === 'received';
  const meName = me?.fullName || me?.full_name || me?.username || 'You';
  const fromName = isReceived ? tx.to : meName;
  const toName = isReceived ? meName : tx.to;
  const fromMeta = isReceived
    ? (tx.kind === 'donation' ? 'Anonymous sender' : tx.bank_type)
    : (me?.phone ? `Phone: ${me.phone}` : '');
  const toMeta = tx.kind === 'donation' ? 'Recipient minimized' : tx.bank_type;

  return (
    <div className="sp-page" style={{ padding: 0 }}>
      <div style={{
        background: '#E6D6FF', borderBottom: '1px solid #DCC8FF',
        padding: '1.9rem 0.95rem 0.95rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, opacity: 0.1 }}>
          <Bird size={144} color="var(--sp-primary)" />
        </div>
        <div className="d-flex justify-content-between align-items-start" style={{ gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 600, lineHeight: 1.1, margin: 0 }}>
              Sparrow<br />Details
            </h1>
            <div className="d-flex align-items-center mt-2 sp-text-muted" style={{ gap: 6 }}>
              <div style={{ height: 8, width: 8, borderRadius: '50%', background: 'var(--sp-primary)' }} />
              <div className="text-truncate">
                {(tx.kind === 'donation' ? 'Donation' : 'Transfer') + (tx.meta ? ` • ${tx.meta}` : '')}
              </div>
            </div>
          </div>
          <button
              className="sp-btn sp-btn-secondary"
              onClick={onShare}
              style={{
              borderRadius: 9999, width: 'auto', padding: '0.32rem 0.72rem', fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.8)', flexShrink: 0,
            }}
          >
            <Share2 size={14} /> Share
          </button>
        </div>
        {shareMsg ? (
          <div
            className="mt-2"
            style={{ fontSize: 12, color: 'var(--sp-primary)', fontWeight: 500 }}
            role="status"
          >
            {shareMsg}
          </div>
        ) : null}
      </div>

      <div style={{ padding: '0.95rem 0.95rem 5.5rem' }}>
        <div className="sp-card">
          <div className="d-flex align-items-start" style={{ gap: '0.75rem' }}>
            <div style={{ height: 40, width: 40, borderRadius: '50%', background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                 className="d-flex align-items-center justify-content-center flex-shrink-0">
              <Bird size={20} color="var(--sp-primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sp-text-muted">From</div>
              <div style={{ fontWeight: 600 }} className="text-truncate">{fromName}</div>
              <div className="sp-text-muted text-truncate">{fromMeta}</div>
            </div>
          </div>
          <div className="sp-divider mt-3" />
          <div className="d-flex align-items-start mt-3" style={{ gap: '0.75rem' }}>
            <div style={{ height: 40, width: 40, borderRadius: '50%', background: '#FEE2E2', border: '1px solid #FECACA' }}
                 className="d-flex align-items-center justify-content-center flex-shrink-0">
              <ArrowUp size={20} color="#DC2626" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sp-text-muted">To</div>
              <div style={{ fontWeight: 600 }} className="text-truncate">{toName}</div>
              <div className="sp-text-muted text-truncate">{toMeta}</div>
            </div>
          </div>
        </div>

        <div className="sp-card mt-3">
          <div className="d-flex justify-content-between" style={{ gap: '0.75rem' }}>
            <div className="d-flex align-items-start" style={{ gap: '0.75rem', minWidth: 0 }}>
              <div style={{
                width: 56, padding: '0.5rem 0', textAlign: 'center',
                borderRadius: 16, background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)', flexShrink: 0,
              }}>
                <div style={{ fontSize: 10, color: 'var(--sp-muted)' }}>{created.toLocaleString(undefined, { month: 'short' })}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{created.getDate()}</div>
                <div style={{ fontSize: 10, color: 'var(--sp-muted)' }}>{created.getFullYear()}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="sp-text-muted">Amount</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Rs. {Number(tx.amount).toLocaleString()}</div>
                <div className="sp-text-muted mt-1" style={{ wordBreak: 'break-all' }}>
                  <strong style={{ color: 'var(--sp-text)' }}>Sparrow ID:</strong> {tx.id}
                </div>
                <div className="sp-text-muted">
                  <strong style={{ color: 'var(--sp-text)' }}>Status:</strong> {tx.status}
                </div>
              </div>
            </div>
            <div className="text-end flex-shrink-0">
              <div style={{ fontWeight: 600, fontSize: 12 }}>{tx.kind === 'donation' ? 'Donation' : 'Transaction'}</div>
              <div className="sp-text-muted">{tx.bank_type}</div>
            </div>
          </div>
        </div>

        <div className="row g-2 mt-3">
          <div className="col-12">
            <button className="sp-btn sp-btn-secondary" onClick={copyId}>
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy ID</>}
            </button>
          </div>
          <div className="col-12">
            <button className="sp-btn" onClick={() => navigate('/app/history')}>Back to history</button>
          </div>
        </div>
      </div>
    </div>
  );
}
