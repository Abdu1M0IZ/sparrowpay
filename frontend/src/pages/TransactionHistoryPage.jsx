// History page - lists transactions or donations with a Pill filter.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bird, ChevronRight, PlusCircle } from 'lucide-react';
import Pill from '../components/common/Pill.jsx';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { listTransactions } from '../services/transactionApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function TransactionHistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('Transactions');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const kind = filter === 'Donations' ? 'donation' : 'transaction';
        const data = await listTransactions(kind);
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(errorToMessage(e));
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div className="sp-page">
      <div className="d-flex align-items-center justify-content-between" style={{ gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>My Sparrows</h1>
        <button
          className="sp-btn sp-btn-secondary"
          style={{ width: 'auto', padding: '0.5rem 0.85rem' }}
          onClick={() => navigate('/app/create')}
        >
          <PlusCircle size={16} /> New
        </button>
      </div>

      <div className="mt-4 d-flex" style={{ gap: '0.5rem' }}>
        <Pill active={filter === 'Transactions'} onClick={() => setFilter('Transactions')}>Transactions</Pill>
        <Pill active={filter === 'Donations'} onClick={() => setFilter('Donations')}>Donations</Pill>
      </div>

      {loading ? (
        <div className="sp-text-muted mt-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="sp-card mt-4 sp-text-muted">No items yet.</div>
      ) : (
        <div className="d-flex flex-column gap-2 mt-4">
          {items.map((t) => (
            <button
              key={t.id}
              className="sp-card text-start w-100"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/app/history/${t.id}`)}
            >
              <div className="d-flex justify-content-between align-items-center" style={{ gap: '0.75rem' }}>
                <div className="d-flex align-items-center" style={{ gap: '0.75rem', minWidth: 0 }}>
                  <div style={{ height: 40, width: 40, borderRadius: '50%', background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                       className="d-flex align-items-center justify-content-center flex-shrink-0">
                    <Bird size={20} color="var(--sp-primary)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }} className="text-truncate">{t.to}</div>
                    <div className="sp-text-muted text-truncate">{t.meta || t.bank_type}</div>
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <div style={{ fontWeight: 600 }}>Rs {Number(t.amount).toLocaleString()}</div>
                  <div className="sp-text-muted">{t.status}</div>
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2 sp-text-muted">
                <div>{new Date(t.created_at || t.createdAt).toLocaleString()}</div>
                <div className="d-inline-flex align-items-center" style={{ gap: 4 }}>
                  View <ChevronRight size={14} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {error ? <div className="mt-4"><ErrorAlert>{error}</ErrorAlert></div> : null}
    </div>
  );
}
