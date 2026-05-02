// Favorites page - list saved beneficiaries; remove or jump to Create with prefill.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bird, Trash2, Send } from 'lucide-react';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { listFavorites, deleteFavorite } from '../services/favoriteApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listFavorites();
      setItems(data);
    } catch (e) {
      setError(errorToMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onDelete(id) {
    setError('');
    try {
      await deleteFavorite(id);
      setItems((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(errorToMessage(e));
    }
  }

  return (
    <div className="sp-page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Favorites</h1>
      <div className="sp-text-muted">Saved beneficiaries</div>

      {error ? <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div> : null}

      {loading ? (
        <div className="sp-text-muted mt-3">Loading…</div>
      ) : items.length === 0 ? (
        <div className="sp-card mt-3 sp-text-muted">No favorites saved yet.</div>
      ) : (
        <div className="row g-2 mt-2">
          {items.map((f) => (
            <div className="col-12 col-sm-6" key={f.id}>
              <div className="sp-card">
                <div className="d-flex align-items-center" style={{ gap: '0.5rem' }}>
                  <div style={{ height: 28, width: 28, borderRadius: '50%', background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
                       className="d-flex align-items-center justify-content-center">
                    <Bird size={14} color="var(--sp-primary)" />
                  </div>
                  <div style={{ fontWeight: 600 }} className="text-truncate">{f.name}</div>
                </div>
                <div className="sp-text-muted mt-1 text-truncate">{f.account_type || f.accountType}</div>
                <div className="d-flex justify-content-end mt-2" style={{ gap: '0.5rem' }}>
                  <button
                    className="sp-btn sp-btn-secondary"
                    style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: 12 }}
                    onClick={() => navigate('/app/create', {
                      state: { prefillTo: f.name, prefillBank: f.account_type || f.accountType },
                    })}
                  >
                    <Send size={14} /> Send
                  </button>
                  <button
                    className="sp-btn sp-btn-danger"
                    style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: 12 }}
                    onClick={() => onDelete(f.id)}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
