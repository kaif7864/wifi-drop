/**
 * client/src/context/AuthContext.jsx
 * Global Shop Authentication Context & Provider
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [shop, setShop] = useState(() => {
    const saved = localStorage.getItem('wifidrop_shop');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('wifidrop_token'));
  const [loading, setLoading] = useState(true);

  // Configure axios default Authorization header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('wifidrop_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('wifidrop_token');
    }
  }, [token]);

  // Fetch shop profile on mount if token exists
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${config.serverUrl}/api/auth/me`);
        if (res.data.success) {
          setShop(res.data.shop);
          localStorage.setItem('wifidrop_shop', JSON.stringify(res.data.shop));
        }
      } catch {
        setToken(null);
        setShop(null);
        localStorage.removeItem('wifidrop_shop');
        localStorage.removeItem('wifidrop_token');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

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

  const logout = useCallback(() => {
    // 1. Wipe all wifidrop keys from localStorage except user preferences (theme/lang)
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

    // 3. Clear auth state and axios authorization headers
    setToken(null);
    setShop(null);
    delete axios.defaults.headers.common['Authorization'];

    // 4. Force guaranteed clean hard page reload to root
    window.location.replace('/?logout=' + Date.now());
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
