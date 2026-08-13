/**
 * client/src/context/AuthContext.jsx
 * Global Shop Authentication Context & Provider
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config';

const AuthContext = createContext(null);

/**
 * Decode JWT payload without verification (for client-side expiry check only)
 * @param {string} token
 * @returns {object|null}
 */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired or about to expire (5-min buffer)
 * @param {string} token
 * @returns {boolean}
 */
function isTokenExpired(token) {
  if (!token) return true;
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;
  return Date.now() / 1000 >= decoded.exp - 300; // 5-min buffer
}

export function AuthProvider({ children }) {
  const [shop, setShop] = useState(() => {
    try {
      const saved = localStorage.getItem('wifidrop_shop');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('wifidrop_token');
    // Don't restore an already-expired token on startup
    if (saved && isTokenExpired(saved)) {
      localStorage.removeItem('wifidrop_token');
      localStorage.removeItem('wifidrop_shop');
      return null;
    }
    return saved || null;
  });

  const [loading, setLoading] = useState(true);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback((_reason = null) => {
    // 1. Wipe all wifidrop keys from localStorage except preferences
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wifidrop_') || key.startsWith('wifi_drop_'))) {
          if (key !== 'wifidrop_theme' && key !== 'wifidrop_lang') {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}

    // 2. Clear sessionStorage
    try { sessionStorage.clear(); } catch {}

    // 3. Clear auth state
    setToken(null);
    setShop(null);
    delete axios.defaults.headers.common['Authorization'];

    // 4. SPA navigate — no hard reload, no history pollution
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // ── Axios Authorization header sync ──────────────────────────────────────
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('wifidrop_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('wifidrop_token');
    }
  }, [token]);

  // ── Axios 401 interceptor — auto-logout on expired/invalid token ──────────
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const currentToken = localStorage.getItem('wifidrop_token');
          if (currentToken) {
            logout('expired');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, [logout]);

  // ── Verify token on mount via server ─────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }

      // Client-side pre-check before hitting server
      if (isTokenExpired(token)) {
        setToken(null);
        setShop(null);
        localStorage.removeItem('wifidrop_shop');
        localStorage.removeItem('wifidrop_token');
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${config.serverUrl}/api/auth/me`);
        if (res.data.success) {
          setShop(res.data.shop);
          localStorage.setItem('wifidrop_shop', JSON.stringify(res.data.shop));
        }
      } catch (err) {
        // Only clear on explicit auth rejection, not on network errors
        if (err.response?.status === 401 || err.response?.status === 403) {
          setToken(null);
          setShop(null);
          localStorage.removeItem('wifidrop_shop');
          localStorage.removeItem('wifidrop_token');
        }
        // Network error: keep cached shop data (offline resilience)
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []); // Run only once on mount

  // ── Periodic token expiry check (every 5 min) ─────────────────────────────
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        logout('expired');
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, logout]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (emailOrShopId, password) => {
    const res = await axios.post(`${config.serverUrl}/api/auth/login`, {
      emailOrShopId,
      password,
    });
    if (res.data.success) {
      setToken(res.data.token);
      setShop(res.data.shop);
      localStorage.setItem('wifidrop_token', res.data.token);
      localStorage.setItem('wifidrop_shop', JSON.stringify(res.data.shop));
      localStorage.removeItem('wifidrop_files_cache_guest');
    }
    return res.data;
  }, []);

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async (shopData) => {
    const res = await axios.post(`${config.serverUrl}/api/auth/register`, shopData);
    if (res.data.success) {
      setToken(res.data.token);
      setShop(res.data.shop);
      localStorage.setItem('wifidrop_token', res.data.token);
      localStorage.setItem('wifidrop_shop', JSON.stringify(res.data.shop));
      localStorage.removeItem('wifidrop_files_cache_guest');
    }
    return res.data;
  }, []);

  return (
    <AuthContext.Provider value={{ shop, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
