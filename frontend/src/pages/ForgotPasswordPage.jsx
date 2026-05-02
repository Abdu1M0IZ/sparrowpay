// Forgot password (reset by PIN) - public page.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { resetPasswordByPin } from '../services/authApi.js';
import { errorToMessage, normalizeAuthError } from '../services/apiClient.js';
import { ErrorAlert } from '../components/common/Alerts.jsx';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Enter your username.');
    if (pin.length !== 4) return setError('PIN must be 4 digits.');
    if (newPassword.length < 10) return setError('Use a strong password (min 10 chars).');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await resetPasswordByPin({
        username: username.trim(),
        pin,
        newPassword,
        confirmPassword,
      });
      navigate('/login', { replace: true, state: { flash: 'Password reset successful. Please sign in.' } });
    } catch (err) {
      setError(normalizeAuthError(errorToMessage(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="d-flex flex-column h-100">
      <div className="mt-4 mt-sm-5">
        <h1 className="text-white" style={{ fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Forgot Password
        </h1>
        <div className="text-white-50 small mt-2">Reset using your 4-digit PIN</div>
      </div>

      <div className="mt-4 d-flex flex-column gap-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}

        <div className="sp-field-dark">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field-dark">
          <KeyRound size={16} color="rgba(255,255,255,0.6)" />
          <input
            placeholder="4-digit PIN"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading}
          />
        </div>
        <div className="sp-field-dark">
          <input
            placeholder="New Password (min 10 chars)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field-dark">
          <input
            placeholder="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="pt-2">
          <Link to="/login" className="text-white-50 text-decoration-underline small">Back to Sign In</Link>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <button
          type="submit"
          className="sp-btn"
          style={{ background: 'rgba(0,0,0,0.45)', padding: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Please wait…' : 'Reset Password'}
        </button>
      </div>
    </form>
  );
}
