// Login page. Submits credentials, stores tokens via AuthContext, redirects
// to the originally requested protected page (or /app/dashboard).

import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorAlert, SuccessAlert } from '../components/common/Alerts.jsx';
import { errorToMessage, normalizeAuthError } from '../services/apiClient.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const flashMsg = location.state?.flash || '';
  const redirectTo = location.state?.from?.pathname || '/app/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
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
          Hi there!
        </h1>
        <div className="text-white-50 small mt-2">Sign in to continue</div>
      </div>

      <div className="mt-4 d-flex flex-column gap-3">
        {flashMsg ? <SuccessAlert>{flashMsg}</SuccessAlert> : null}
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}

        <div className="sp-field-dark">
          <input
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="sp-field-dark">
          <input
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="d-flex justify-content-between text-white-50 small pt-2">
          <Link to="/signup" className="text-white-50 text-decoration-underline">Sign Up</Link>
          <Link to="/forgot-password" className="text-white-50 text-decoration-underline">Forgot Password?</Link>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <button
          type="submit"
          className="sp-btn"
          style={{ background: 'rgba(0,0,0,0.45)', padding: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Please wait…' : 'Sign In'}
        </button>
      </div>
    </form>
  );
}
