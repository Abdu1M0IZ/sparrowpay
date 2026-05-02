// Change password page - requires current password.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert, SuccessAlert } from '../components/common/Alerts.jsx';
import { changePassword } from '../services/meApi.js';
import { errorToMessage } from '../services/apiClient.js';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword) return setError('Please enter your current password.');
    if (newPassword.length < 10) return setError('New password must be at least 10 characters.');
    if (newPassword !== confirmPassword) return setError('New passwords do not match.');
    if (currentPassword === newPassword) return setError('New password must differ from current password.');

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e2) {
      setError(errorToMessage(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sp-page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Change Password</h1>
      <div className="sp-text-muted">Requires your current password</div>

      <div className="d-flex flex-column gap-3 mt-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {success ? <SuccessAlert>{success}</SuccessAlert> : null}

        <div className="sp-field">
          <input
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            type="password"
            placeholder="New password (min 10 chars)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field">
          <input
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" className="sp-btn" disabled={loading}>
          {loading ? 'Updating…' : 'Update Password'}
        </button>
        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => navigate('/app/account')}>
          Back
        </button>
      </div>
    </form>
  );
}
