// Central axios client.
//
// - Reads VITE_API_BASE_URL from the environment (falls back to localhost).
// - Attaches the access token from localStorage to every request.
// - On 401, tries to refresh once using the stored refresh token and retries
//   the original request. If refresh also fails, clears tokens.
//
// Token persistence is intentionally separate from React state so that a hard
// browser refresh on a protected route can pick up the existing session.

import axios from 'axios';

export const TOKEN_KEYS = {
  access: 'sp_access',
  refresh: 'sp_refresh',
};

const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  // The browser will set a reasonable default; explicit timeout for slow networks.
  timeout: 20_000,
});

export function getAccessToken() { return localStorage.getItem(TOKEN_KEYS.access) || ''; }
export function getRefreshToken() { return localStorage.getItem(TOKEN_KEYS.refresh) || ''; }

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(TOKEN_KEYS.access, accessToken);
  if (refreshToken) localStorage.setItem(TOKEN_KEYS.refresh, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEYS.access);
  localStorage.removeItem(TOKEN_KEYS.refresh);
}

// Attach Authorization header on every request.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-on-401 interceptor. Coalesces concurrent refreshes.
let refreshing = null;

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  // Use a bare axios call so this request doesn't re-trigger the interceptor.
  const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken, refresh_token: refreshToken });
  const data = res.data || {};
  const accessToken = data.accessToken || data.access_token;
  const newRefresh = data.refreshToken || data.refresh_token;
  if (!accessToken || !newRefresh) throw new Error('Refresh response missing tokens');
  setTokens({ accessToken, refreshToken: newRefresh });
  return accessToken;
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    if (status === 401 && !original._retry && getRefreshToken() && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        if (!refreshing) refreshing = performRefresh().finally(() => { refreshing = null; });
        const newAccess = await refreshing;
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
        return apiClient(original);
      } catch (refreshErr) {
        clearTokens();
        // Bubble the original 401 up so the AuthContext can react.
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// Translate any axios/server error into a human-readable message.
export function errorToMessage(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const data = err.response?.data;
  if (data) {
    if (typeof data.message === 'string' && data.message) return data.message;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  }
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch { return 'Unknown error'; }
}

// Friendly normalisation for common auth errors.
export function normalizeAuthError(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('username already exists')) return 'Username already exists. Please choose another username.';
  if (m.includes('invalid credentials')) return 'Invalid username or password.';
  return msg || 'Something went wrong.';
}

export function normalizeTxError(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('recipient sparrowpay user not found')) {
    return 'Recipient SparrowPay account does not exist. Please check the username.';
  }
  return msg || 'Transaction failed.';
}
