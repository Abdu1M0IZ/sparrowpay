// Account details page - shows profile, allows fullName/phone edit, and
// links to all other account-related pages (change password, change PIN,
// forgot PIN, support, logout).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserRound, KeyRound, Lock, LifeBuoy, LogOut, ChevronRight, Edit2, Save, X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorAlert, SuccessAlert } from '../components/common/Alerts.jsx';
import { updateProfile } from '../services/meApi.js';
import { errorToMessage } from '../services/apiClient.js';
import { formatPkPhone, PK_PHONE_RE } from '../utils/format.js';

export default function AccountDetailsPage() {
  const { me, setMe, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(me?.fullName || me?.full_name || '');
  const [phone, setPhone] = useState(me?.phone || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    setSuccess('');
    if (phone && !PK_PHONE_RE.test(phone)) {
      setError('Phone must be 03XX-XXXXXXX (e.g., 0301-1234567).');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({ fullName, phone });
      setMe((prev) => ({ ...(prev || {}), ...updated }));
      setSuccess('Profile updated.');
      setEditing(false);
    } catch (e) {
      setError(errorToMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const cells = [
    {
      Icon: KeyRound, label: 'Change Password', sub: 'Requires current password',
      onClick: () => navigate('/app/account/change-password'),
    },
    {
      Icon: KeyRound, label: 'Change PIN', sub: 'Requires current PIN',
      onClick: () => navigate('/app/account/change-pin'),
    },
    {
      Icon: Lock, label: 'Forgot PIN', sub: 'Verify password to reset',
      onClick: () => navigate('/app/account/forgot-pin'),
    },
    {
      Icon: LifeBuoy, label: 'Contact Support', sub: 'Help & security',
      onClick: () => navigate('/app/support'),
    },
  ];

  return (
    <div className="sp-page">
      <div className="d-flex justify-content-between align-items-center">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Account</h1>
        {!editing ? (
          <button className="sp-btn sp-btn-secondary" style={{ width: 'auto', padding: '0.35rem 0.7rem' }} onClick={() => setEditing(true)}>
            <Edit2 size={14} /> Edit
          </button>
        ) : (
          <div className="d-flex" style={{ gap: '0.4rem' }}>
            <button
              className="sp-btn"
              style={{ width: 'auto', padding: '0.35rem 0.7rem' }}
              onClick={save}
              disabled={saving}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="sp-btn sp-btn-ghost"
              style={{ width: 'auto', padding: '0.35rem 0.7rem' }}
              onClick={() => { setEditing(false); setFullName(me?.fullName || me?.full_name || ''); setPhone(me?.phone || ''); setError(''); }}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {error ? <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div> : null}
      {success ? <div className="mt-3"><SuccessAlert>{success}</SuccessAlert></div> : null}

      <div className="sp-card mt-3">
        <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
          <div style={{ height: 56, width: 56, borderRadius: '50%', background: 'var(--sp-purple-100)', border: '1px solid var(--sp-purple-200)' }}
               className="d-flex align-items-center justify-content-center">
            <UserRound size={28} color="var(--sp-primary)" />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{me?.fullName || me?.full_name || me?.username}</div>
            <div className="sp-text-muted">@{me?.username}</div>
          </div>
        </div>

        <div className="sp-divider mt-3" />

        <div className="mt-3">
          <div className="sp-text-muted">Username</div>
          <div style={{ fontWeight: 500 }}>{me?.username || '—'}</div>
        </div>

        <div className="mt-3">
          <div className="sp-text-muted">Full name</div>
          {editing ? (
            <div className="sp-field mt-1">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={128} />
            </div>
          ) : (
            <div style={{ fontWeight: 500 }}>{me?.fullName || me?.full_name || '—'}</div>
          )}
        </div>

        <div className="mt-3">
          <div className="sp-text-muted">Phone</div>
          {editing ? (
            <div className="sp-field mt-1">
              <input
                value={phone}
                onChange={(e) => setPhone(formatPkPhone(e.target.value))}
                inputMode="numeric"
                maxLength={12}
                placeholder="03XX-XXXXXXX"
              />
            </div>
          ) : (
            <div style={{ fontWeight: 500 }}>{me?.phone || '—'}</div>
          )}
        </div>

        <div className="mt-3">
          <div className="sp-text-muted">CNIC</div>
          <div style={{ fontWeight: 500 }}>{me?.cnic || '—'}</div>
        </div>

        <div className="mt-3">
          <div className="sp-text-muted">Balance</div>
          <div style={{ fontWeight: 600 }}>Rs {Number(me?.balance || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="d-flex flex-column gap-2 mt-3">
        {cells.map(({ Icon, label, sub, onClick }) => (
          <button key={label} className="sp-card text-start w-100" style={{ cursor: 'pointer' }} onClick={onClick}>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                <Icon size={20} />
                <div>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  <div className="sp-text-muted">{sub}</div>
                </div>
              </div>
              <ChevronRight size={16} color="#9CA3AF" />
            </div>
          </button>
        ))}

        <button
          className="sp-card text-start w-100"
          style={{ cursor: 'pointer', background: '#FEF2F2', borderColor: '#FECACA' }}
          onClick={onLogout}
        >
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
              <LogOut size={20} color="#B91C1C" />
              <div>
                <div style={{ fontWeight: 600, color: '#991B1B' }}>Log Out</div>
                <div style={{ fontSize: 12, color: '#B91C1C' }}>End session</div>
              </div>
            </div>
            <ChevronRight size={16} color="#B91C1C" />
          </div>
        </button>
      </div>
    </div>
  );
}
