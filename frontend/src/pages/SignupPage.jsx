// Signup page - two-step form (credentials -> KYC) using the proper
// /api/auth/check-username endpoint instead of the old signup-abuse pattern.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { checkUsername } from '../services/authApi.js';
import { errorToMessage, normalizeAuthError } from '../services/apiClient.js';
import { ErrorAlert } from '../components/common/Alerts.jsx';
import { formatPkPhone, formatPkCnic, PK_PHONE_RE, PK_CNIC_RE } from '../utils/format.js';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [pin, setPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Username availability state
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState(false);
  const debounceRef = useRef(null);

  // Debounced username availability check.
  useEffect(() => {
    if (step !== 1 || !username.trim() || username.trim().length < 3) {
      setTaken(false);
      setChecking(false);
      return undefined;
    }
    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await checkUsername(username.trim());
        setTaken(!r.available);
      } catch {
        setTaken(false);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [username, step]);

  function validateStep1() {
    if (!username.trim()) return 'Username is required.';
    if (username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (password.length < 10) return 'Use a strong password (min 10 chars).';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (taken) return 'Username already exists. Please choose another.';
    return '';
  }

  function validateStep2() {
    if (!PK_PHONE_RE.test(phone.trim())) return 'Phone must be 03XX-XXXXXXX (e.g., 0301-1234567).';
    if (!PK_CNIC_RE.test(cnic.trim())) return 'CNIC must be #####-#######-# (e.g., 35202-1234567-1).';
    if (pin.length !== 4) return 'PIN must be 4 digits.';
    return '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (step === 1) {
      const v = validateStep1();
      if (v) { setError(v); return; }
      // Final live re-check to be safe.
      try {
        const r = await checkUsername(username.trim());
        if (!r.available) { setError('Username already exists. Please choose another.'); return; }
      } catch { /* allow proceed - backend will enforce */ }
      setStep(2);
      return;
    }

    const v = validateStep2();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      await signup({
        fullName: fullName.trim() || null,
        username: username.trim(),
        password,
        phone: phone.trim(),
        cnic: cnic.trim(),
        pin,
      });
      navigate('/app/dashboard', { replace: true });
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
          {step === 1 ? 'Create account' : 'Verify details'}
        </h1>
        <div className="text-white-50 small mt-2">
          {step === 1 ? 'Set up your SparrowPay login' : 'Phone, CNIC, and your 4-digit PIN'}
        </div>
      </div>

      <div className="mt-4 d-flex flex-column gap-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}

        {step === 1 && (
          <>
            <div className="sp-field-dark">
              <input
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="sp-field-dark">
              <input
                placeholder="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="px-1" style={{ marginTop: '-0.5rem' }}>
              <div className="text-white-50" style={{ fontSize: 11 }}>
                {checking ? 'Checking username…' : (taken ? 'Username already exists.' : '')}
              </div>
            </div>
            <div className="sp-field-dark">
              <input
                placeholder="Password (min 10 chars)"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="sp-field-dark">
              <input
                placeholder="Confirm Password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="sp-field-dark">
              <input
                placeholder="Phone (03XX-XXXXXXX)"
                inputMode="numeric"
                maxLength={12}
                value={phone}
                onChange={(e) => setPhone(formatPkPhone(e.target.value))}
                disabled={loading}
              />
            </div>
            <div className="sp-field-dark">
              <input
                placeholder="CNIC (#####-#######-#)"
                inputMode="numeric"
                maxLength={15}
                value={cnic}
                onChange={(e) => setCnic(formatPkCnic(e.target.value))}
                disabled={loading}
              />
            </div>
            <div className="sp-field-dark">
              <KeyRound size={16} color="rgba(255,255,255,0.6)" />
              <input
                placeholder="Account 4-digit PIN"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                disabled={loading}
              />
            </div>
          </>
        )}

        <div className="d-flex justify-content-between text-white-50 small pt-2">
          {step === 1 ? (
            <Link to="/login" className="text-white-50 text-decoration-underline">Back to Sign In</Link>
          ) : (
            <button type="button" className="btn btn-link p-0 text-white-50 text-decoration-underline" onClick={() => setStep(1)}>
              Back
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto pt-3">
        <button
          type="submit"
          className="sp-btn"
          style={{ background: 'rgba(0,0,0,0.45)', padding: '1rem' }}
          disabled={loading || checking || (step === 1 && taken)}
        >
          {loading ? 'Please wait…' : step === 1 ? (checking ? 'Checking…' : 'Next') : 'Create Account'}
        </button>
      </div>
    </form>
  );
}
