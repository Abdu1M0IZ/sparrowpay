// Forgot PIN page (logged in) - reset PIN by verifying password.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorAlert, SuccessAlert } from '../components/common/Alerts.jsx';
import { forgotPin } from '../services/authApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function ForgotPinPage() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [username, setUsername] = useState(me?.username || '');
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!username.trim() || !password) return setError('Enter your username and password.');
    if (newPin.length !== 4) return setError('New PIN must be 4 digits.');
    if (newPin !== confirmPin) return setError('PINs do not match.');

    setLoading(true);
    try {
      await forgotPin({ username: username.trim(), password, newPin, confirmPin });
      setSuccess('PIN reset successfully.');
      setPassword('');
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Forgot PIN</h1>
      <div className="sp-text-muted">Verify your password to reset your PIN</div>

      <div className="d-flex flex-column gap-3 mt-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {success ? <SuccessAlert>{success}</SuccessAlert> : null}

        <div className="sp-field">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            placeholder="New 4-digit PIN"
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
          {loading ? 'Resetting…' : 'Reset PIN'}
        </button>
        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => navigate('/app/account')}>
          Back
        </button>
      </div>
    </form>
  );
}
