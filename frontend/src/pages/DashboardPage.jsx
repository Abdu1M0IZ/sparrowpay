// Dashboard / home - shows balance, in/out totals, recent transactions, and quick actions.

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bird, Bell, Search, ArrowUp, ArrowDown, PlusCircle, History, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { listTransactions } from '../services/transactionApi.js';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { formatCompactPKR } from '../utils/format.js';
import { errorToMessage } from '../services/apiClient.js';

export default function DashboardPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [txs, donations] = await Promise.all([
          listTransactions('transaction'),
          listTransactions('donation'),
        ]);
        if (cancelled) return;
        const all = [...txs, ...donations].sort(
          (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
        );
        setActivity(all);
        setRecent(txs.slice(0, 3));
      } catch (e) {
        if (!cancelled) setError(errorToMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [me?.balance]);

  const stats = useMemo(() => {
    const out = activity
      .filter((t) => String(t.status || '').toLowerCase() !== 'received')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const inn = activity
      .filter((t) => String(t.status || '').toLowerCase() === 'received')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return { out, inn };
  }, [activity]);

  return (
    <div className="sp-page">
      {/* Top bar */}
      <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
        <button
          className="d-flex align-items-center justify-content-center"
          style={{
            height: 40, width: 40, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--sp-card-border)',
          }}
          onClick={() => navigate('/app/account')}
          aria-label="Account"
        >
          <UserRound size={20} />
        </button>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center"
               style={{ height: 40, borderRadius: 9999, background: '#fff', border: '1px solid var(--sp-card-border)', padding: '0 0.75rem', gap: '0.5rem' }}>
            <Search size={16} color="#6B7280" />
            <span className="sp-text-muted">Search sparrows</span>
          </div>
        </div>
        <button
          className="d-flex align-items-center justify-content-center"
          style={{ height: 40, width: 40, borderRadius: '50%', background: '#fff', border: '1px solid var(--sp-card-border)' }}
          aria-label="Notifications"
        >
          <Bell size={20} />
        </button>
      </div>

      <div className="mt-4">
        <div className="sp-text-muted">Welcome back</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{me?.fullName || me?.full_name || me?.username || 'User'}</div>
      </div>

      {/* Balance card */}
      <div
        style={{
          marginTop: '1rem',
          background: '#E6D6FF',
          border: '1px solid #DCC8FF',
          borderRadius: '1.5rem',
          padding: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -40, right: -40, opacity: 0.1 }}>
          <Bird size={144} color="var(--sp-primary)" />
        </div>
        <div className="sp-text-muted">Available balance</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 600, marginTop: 4 }}>
          Rs {Number(me?.balance || 0).toLocaleString()}
        </div>

        <div className="d-flex gap-2 mt-3">
          <button
            className="sp-btn"
            style={{ borderRadius: '9999px', width: '50%', minHeight: 52, fontSize: '0.86rem', padding: '0.55rem 0.7rem' }}
            onClick={() => navigate('/app/create')}
          >
            <PlusCircle size={16} /> Create Sparrow
          </button>
          <button
            className="sp-btn sp-btn-secondary"
            style={{ borderRadius: '9999px', width: '50%', minHeight: 52, fontSize: '0.86rem', padding: '0.55rem 0.7rem' }}
            onClick={() => navigate('/app/history')}
          >
            <History size={16} /> My Sparrows
          </button>
        </div>

        <div className="row g-2 mt-2">
          <div className="col-6">
            <div className="sp-card d-flex align-items-center" style={{ background: 'rgba(255,255,255,0.7)', gap: '0.75rem' }}>
              <div style={{ height: 40, width: 40, borderRadius: '50%', background: '#FEE2E2', border: '1px solid #FECACA' }}
                   className="d-flex align-items-center justify-content-center">
                <ArrowUp size={20} color="#DC2626" />
              </div>
              <div>
                <div className="sp-text-muted">Balance Out</div>
                <div style={{ fontWeight: 600 }} title={`-Rs ${stats.out.toLocaleString()}`}>
                  -Rs {formatCompactPKR(stats.out)}
                </div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="sp-card d-flex align-items-center" style={{ background: 'rgba(255,255,255,0.7)', gap: '0.75rem' }}>
              <div style={{ height: 40, width: 40, borderRadius: '50%', background: '#DCFCE7', border: '1px solid #BBF7D0' }}
                   className="d-flex align-items-center justify-content-center">
                <ArrowDown size={20} color="#15803D" />
              </div>
              <div>
                <div className="sp-text-muted">Balance In</div>
                <div style={{ fontWeight: 600 }} title={`+Rs ${stats.inn.toLocaleString()}`}>
                  +Rs {formatCompactPKR(stats.inn)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div> : null}

      {/* Quick actions */}
      <div className="mt-4">
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Quick actions</div>
        <div className="row g-2 mt-2">
          <div className="col-6">
            <button
              className="sp-card text-start w-100"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/app/create', { state: { kind: 'transaction' } })}
            >
              <div style={{ height: 36, width: 36, borderRadius: 12, background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                   className="d-flex align-items-center justify-content-center">
                <Bird size={18} color="var(--sp-primary)" />
              </div>
              <div className="mt-2" style={{ fontWeight: 600 }}>Sparrow Money</div>
              <div className="sp-text-muted">Transaction</div>
            </button>
          </div>
          <div className="col-6">
            <button
              className="sp-card text-start w-100"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/app/create', { state: { kind: 'donation' } })}
            >
              <div style={{ height: 36, width: 36, borderRadius: 12, background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                   className="d-flex align-items-center justify-content-center">
                <Bird size={18} color="var(--sp-primary)" />
              </div>
              <div className="mt-2" style={{ fontWeight: 600 }}>Sparrow Donation</div>
              <div className="sp-text-muted">Donate anonymously</div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="mt-4">
        <div className="d-flex align-items-center justify-content-between" style={{ gap: '0.75rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Recent Transactions</div>
          <button
            className="sp-btn-ghost"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', borderRadius: '0.65rem', fontSize: '0.78rem' }}
            onClick={() => navigate('/app/history')}
          >
            View More
          </button>
        </div>
        {loading ? (
          <div className="sp-text-muted mt-2">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="sp-card mt-2 sp-text-muted">No transactions yet.</div>
        ) : (
          <div className="d-flex flex-column gap-2 mt-2">
            {recent.map((t) => (
              <button
                key={t.id}
                className="sp-card text-start w-100"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/app/history/${t.id}`)}
              >
                <div className="d-flex justify-content-between align-items-center" style={{ gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }} className="text-truncate">{t.to}</div>
                    <div className="sp-text-muted text-truncate">{t.meta || t.bank_type}</div>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <div style={{ fontWeight: 600 }}>Rs {Number(t.amount).toLocaleString()}</div>
                    <div className="sp-text-muted">{new Date(t.created_at || t.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
