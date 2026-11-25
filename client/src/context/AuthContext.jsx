import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    let cancelled = false;
    let timer;

    // Retry while the API is unreachable (e.g. the page loaded before the server finished starting).
    async function boot(attempt = 0) {
      try {
        const m = await api('/meta');
        if (cancelled) return;
        setMeta(m);
        if (getToken()) {
          try {
            const d = await api('/me');
            if (!cancelled) setUser(d.user);
          } catch (e) {
            if (e.status === 401) setToken(null);
            else throw e;
          }
        }
        if (!cancelled) { setError(''); setLoading(false); }
      } catch {
        if (cancelled) return;
        setError('Cannot reach the server. Retrying… (is the API running on port 4100?)');
        setLoading(false);
        timer = setTimeout(() => boot(attempt + 1), Math.min(1000 * 2 ** attempt, 10000));
      }
    }
    boot();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [logout]);

  const login = useCallback((token, u) => {
    setToken(token);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, meta, loading, error, login, logout }),
    [user, meta, loading, error, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
