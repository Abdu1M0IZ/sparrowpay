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

  return (
    <div className="sp-page" style={{ padding: 0 }}>
      <div style={{
        background: '#E6D6FF', borderBottom: '1px solid #DCC8FF',
        padding: '2.5rem 1.25rem 1.25rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, opacity: 0.1 }}>
          <Bird size={144} color="var(--sp-primary)" />
        </div>
        <div className="d-flex justify-content-between align-items-start" style={{ gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.1 }}>
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
            style={{
              borderRadius: 9999, width: 'auto', padding: '0.4rem 0.85rem',
              background: 'rgba(255,255,255,0.8)', flexShrink: 0,
            }}
          >
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.25rem 6rem' }}>
        <div className="sp-card">
          <div className="d-flex align-items-start" style={{ gap: '0.75rem' }}>
            <div style={{ height: 40, width: 40, borderRadius: '50%', background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                 className="d-flex align-items-center justify-content-center flex-shrink-0">
              <Bird size={20} color="var(--sp-primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sp-text-muted">From</div>
              <div style={{ fontWeight: 600 }} className="text-truncate">{me?.fullName || me?.full_name || me?.username || 'You'}</div>
              <div className="sp-text-muted text-truncate">{me?.phone ? `Phone: ${me.phone}` : ''}</div>
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
              <div style={{ fontWeight: 600 }} className="text-truncate">{tx.to}</div>
              <div className="sp-text-muted text-truncate">
                {tx.kind === 'donation' ? 'Recipient minimized' : tx.bank_type}
              </div>
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
                <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>Rs. {Number(tx.amount).toLocaleString()}</div>
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
          <div className="col-12 col-sm-6">
            <button className="sp-btn sp-btn-secondary" onClick={copyId}>
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy ID</>}
            </button>
          </div>
          <div className="col-12 col-sm-6">
            <button className="sp-btn" onClick={() => navigate('/app/history')}>Back to history</button>
          </div>
        </div>
      </div>
    </div>
  );
}
