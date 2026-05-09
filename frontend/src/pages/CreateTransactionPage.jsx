// Create transaction page - bank type, mode (transaction/donation),
// recipient, amount, then PIN modal to confirm.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Star, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import Pill from '../components/common/Pill.jsx';
import Modal from '../components/common/Modal.jsx';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { listFavorites, toggleFavorite } from '../services/favoriteApi.js';
import { createTransaction } from '../services/transactionApi.js';
import { errorToMessage, normalizeTxError } from '../services/apiClient.js';
import { parseAmount } from '../utils/format.js';

const BANKS = ['SparrowPay', 'SadaPay', 'JazzCash'];

export default function CreateTransactionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, refreshMe } = useAuth();

  const [kind, setKind] = useState(location.state?.kind || 'transaction');
  const [bankType, setBankType] = useState(location.state?.prefillBank || 'SparrowPay');
  const [to, setTo] = useState(location.state?.prefillTo || '');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');

  const [pinOpen, setPinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [favorites, setFavorites] = useState([]);
  const [favError, setFavError] = useState('');
  const [favLoading, setFavLoading] = useState(true);
  const ouchRef = useRef(null);

  async function loadFavorites() {
    setFavLoading(true);
    setFavError('');
    try {
      const items = await listFavorites();
      setFavorites(items);
    } catch (e) {
      setFavError(errorToMessage(e));
    } finally {
      setFavLoading(false);
    }
  }

  // Load favourites once so users can pick from saved recipients in this page.
  useEffect(() => {
    loadFavorites();
  }, []);

  const currentFav = useMemo(() => {
    const name = (to || '').trim().toLowerCase();
    if (!name) return null;
    return favorites.find(
      (f) => (f.name || '').trim().toLowerCase() === name && f.account_type === bankType
    );
  }, [favorites, to, bankType]);

  async function onToggleFavorite() {
    setFavError('');
    const name = (to || '').trim();
    if (!name) {
      setFavError('Enter an Account Name first.');
      return;
    }
    try {
      await toggleFavorite({ name, accountType: bankType });
      await loadFavorites();
    } catch (e) {
      setFavError(errorToMessage(e));
    }
  }

  function requestPin(e) {
    e?.preventDefault?.();
    setError('');
    const amt = parseAmount(amount);
    if (!to.trim() || amt <= 0) {
      setError('Please enter Account Name and Amount.');
      return;
    }
    if (amt > Number(me?.balance || 0)) {
      setError('Insufficient funds.');
      return;
    }
    setPinOpen(true);
  }

  async function confirmPin() {
    if (pin.length !== 4) return;
    setSubmitting(true);
    setError('');
    try {
      const created = await createTransaction({
        kind,
        bankType,
        to: to.trim(),
        amount: parseAmount(amount),
        pin,
      });
      try {
        if (!ouchRef.current) {
          ouchRef.current = new Audio('/sounds/ouch.mp3');
          ouchRef.current.preload = 'auto';
        }
        ouchRef.current.currentTime = 0;
        await ouchRef.current.play();
      } catch {
        // Ignore playback failures (browser gesture policies, missing device audio, etc.).
      }
      // Refresh /me so dashboard balance is up to date.
      await refreshMe();
      setPinOpen(false);
      setPin('');
      // Navigate to the detail page for the just-created transaction.
      navigate(`/app/history/${created.id}`, { replace: true });
    } catch (e) {
      setError(normalizeTxError(errorToMessage(e)));
      // Donations can partially complete before an error is surfaced
      // (e.g., timeout on a later chunk). Refresh wallet state so sender
      // sees actual debited balance immediately.
      try { await refreshMe(); } catch { /* best-effort */ }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sp-page">
      <div className="d-flex justify-content-between align-items-center">
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600, margin: 0 }}>Sparrow Creation</h1>
        <button
          className="d-flex align-items-center justify-content-center"
          style={{
            height: 56,
            width: 56,
            borderRadius: '50%',
            border: '1px solid var(--sp-card-border)',
            background: '#fff',
          }}
          onClick={() => navigate('/app/dashboard')}
          aria-label="Close"
        >
          <X size={30} color="#4B5563" />
        </button>
      </div>

      {error ? <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div> : null}
      {favError ? <div className="mt-3"><ErrorAlert>{favError}</ErrorAlert></div> : null}

      <div className="sp-card mt-3">
        <div className="d-flex justify-content-between align-items-center" style={{ gap: '0.75rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Favourites</div>
          <button
            className="sp-btn-ghost"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', borderRadius: '0.65rem', fontSize: '0.8rem' }}
            onClick={loadFavorites}
            type="button"
          >
            Refresh
          </button>
        </div>
        {favLoading ? (
          <div className="sp-card mt-2 sp-text-muted">Loading favourites…</div>
        ) : favorites.length === 0 ? (
          <div className="sp-card mt-2 sp-text-muted">No favourites yet. Star an account name to save it.</div>
        ) : (
          <div className="d-flex flex-wrap mt-2" style={{ gap: '0.5rem' }}>
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                className="sp-pill"
                onClick={() => {
                  setTo(f.name || '');
                  setBankType(f.account_type || f.accountType || 'SparrowPay');
                }}
                title={`Use ${f.name}`}
              >
                {f.name} ({f.account_type || f.accountType})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sp-card mt-3">
        <div className="sp-text-muted">Bank type</div>
        <div className="mt-1 sp-field">
          <select
            value={bankType}
            onChange={(e) => setBankType(e.target.value)}
          >
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="sp-text-muted mt-3">Mode</div>
        <div className="mt-1 d-flex flex-wrap" style={{ gap: '0.5rem' }}>
          <Pill active={kind === 'transaction'} onClick={() => setKind('transaction')}>Transaction</Pill>
          <Pill active={kind === 'donation'} onClick={() => setKind('donation')}>Donation</Pill>
        </div>

        <div className="sp-text-muted mt-3">Account Name</div>
        <div className="mt-1 sp-field">
          <input
            placeholder={kind === 'transaction' ? 'Recipient username / name' : 'Charity name'}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            type="button"
            onClick={onToggleFavorite}
            className="d-flex align-items-center justify-content-center"
            style={{
              height: 36, width: 36, borderRadius: '50%', border: '1px solid var(--sp-card-border)',
              background: currentFav ? '#FFF6D6' : '#fff', cursor: 'pointer',
            }}
            aria-label={currentFav ? 'Remove from favourites' : 'Add to favourites'}
            title={currentFav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Star size={18}
              color={currentFav ? '#B77900' : '#9CA3AF'}
              fill={currentFav ? '#B77900' : 'none'}
            />
          </button>
        </div>

        <div className="sp-text-muted mt-3">Amount (PKR)</div>
        <div className="mt-1 sp-field">
          <input
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
          />
        </div>

        <button
          className="sp-btn mt-3"
          onClick={requestPin}
          disabled={!to.trim() || parseAmount(amount) <= 0}
        >
          Continue
        </button>
        <div className="text-center mt-2 sp-text-muted d-flex justify-content-center align-items-center" style={{ gap: 6, fontSize: 11 }}>
          <Lock size={14} /> PIN required to send
        </div>
      </div>

      <Modal open={pinOpen} title="Enter PIN" onClose={() => { setPinOpen(false); setPin(''); setError(''); }}>
        <div className="d-flex flex-column gap-2">
          <div className="sp-text-muted">Confirm with your 4-digit account PIN</div>
          <div className="sp-field">
            <input
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoFocus
            />
          </div>
          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          <button className="sp-btn" disabled={pin.length !== 4 || submitting} onClick={confirmPin}>
            {submitting ? 'Submitting…' : 'Confirm'}
          </button>
          <button
            className="sp-btn sp-btn-ghost"
            onClick={() => { setPinOpen(false); setPin(''); setError(''); }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
