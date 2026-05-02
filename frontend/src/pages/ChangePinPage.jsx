// Change PIN page - requires current PIN.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert, SuccessAlert } from '../components/common/Alerts.jsx';
import { changePin } from '../services/meApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function ChangePinPage() {
  const navigate = useNavigate();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (currentPin.length !== 4) return setError('Current PIN must be 4 digits.');
    if (newPin.length !== 4) return setError('New PIN must be 4 digits.');
    if (newPin !== confirmPin) return setError('New PINs do not match.');

    setLoading(true);
    try {
      await changePin({ currentPin, newPin, confirmPin });
      setSuccess('PIN updated successfully.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e2) {
      setError(errorToMessage(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sp-page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Change PIN</h1>
      <div className="sp-text-muted">Requires your current PIN</div>

      <div className="d-flex flex-column gap-3 mt-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {success ? <SuccessAlert>{success}</SuccessAlert> : null}

        <div className="sp-field">
          <input
            placeholder="Current PIN"
            inputMode="numeric"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            placeholder="New PIN"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            placeholder="Confirm new PIN"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading}
          />
        </div>

        <button type="submit" className="sp-btn" disabled={loading}>
          {loading ? 'Updating…' : 'Update PIN'}
        </button>
        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => navigate('/app/account')}>
          Back
        </button>
      </div>
    </form>
  );
}
