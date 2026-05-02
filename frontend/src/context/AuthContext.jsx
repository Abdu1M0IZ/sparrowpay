// AuthContext provides authentication state, current user, and auth actions
// to the whole React tree. Tokens live in localStorage (managed by
// services/apiClient) so they survive a hard refresh.

import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  setTokens, clearTokens, getAccessToken, getRefreshToken,
} from '../services/apiClient.js';
import * as authApi from '../services/authApi.js';
import { fetchMe } from '../services/meApi.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initial authed state derives from token presence in localStorage.
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(() => Boolean(getAccessToken()));
  const [loading, setLoading] = useState(Boolean(getAccessToken()));
  const [globalError, setGlobalError] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  // Hydrate /me on initial load if we have a token.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchMe();
        if (!cancelled) {
          setMe(data);
          setAuthed(true);
        }
      } catch {
        if (!cancelled) {
          // Token is invalid - clear and force re-login.
          clearTokens();
          setMe(null);
          setAuthed(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const data = await fetchMe();
      setMe(data);
      return data;
    } catch (err) {
      setGlobalError('Failed to refresh user data.');
      throw err;
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    setTokens({
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
    });
    setAuthed(true);
    const meData = await fetchMe();
    setMe(meData);
    return meData;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await authApi.signup(payload);
    setTokens({
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
    });
    setAuthed(true);
    const meData = await fetchMe();
    setMe(meData);
    return meData;
  }, []);

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try { await authApi.logout(rt); } catch { /* best-effort */ }
    clearTokens();
    setMe(null);
    setAuthed(false);
  }, []);

  // Clear tokens and state without calling the server. Useful when the
  // refresh interceptor has already failed.
  const forceLogout = useCallback(() => {
    clearTokens();
    setMe(null);
    setAuthed(false);
  }, []);

  const value = useMemo(() => ({
    me,
    authed,
    loading,
    globalError,
    setGlobalError,
    login,
    signup,
    logout,
    forceLogout,
    refreshMe,
    setMe,
  }), [me, authed, loading, globalError, login, signup, logout, forceLogout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
