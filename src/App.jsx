/**
 * client/src/App.jsx
 * Root component — Route switcher & AuthProvider wrapper
 */

import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LaptopView } from './pages/LaptopView';
import { MobileView } from './pages/MobileView';
import { ShopLogin } from './pages/ShopLogin';
import { ShopRegister } from './pages/ShopRegister';

function getCurrentRoute() {
  const path = window.location.pathname;
  if (path === '/login') return 'login';
  if (path === '/register') return 'register';
  if (path.startsWith('/mobile')) return 'mobile';
  return 'dashboard';
}

/**
 * Global SPA navigate helper — use instead of window.location.href
 * Pushes to history without full page reload.
 * @param {string} path - Route path e.g. '/', '/login'
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function navigate(path, replace = false) {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  // Dispatch popstate so App re-renders
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AppInner() {
  const [route, setRoute] = useState(getCurrentRoute);
  const { shop, token, loading } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('wifidrop_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    const handlePopState = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auth-based route guards — runs after auth check completes
  useEffect(() => {
    if (loading) return; // Wait until auth is resolved

    const currentRoute = getCurrentRoute();

    // If logged in and on login/register page → redirect to dashboard
    if (token && shop && (currentRoute === 'login' || currentRoute === 'register')) {
      navigate('/', true); // replaceState — removes login from history
      return;
    }

    // Keep route in sync
    setRoute(getCurrentRoute());
  }, [loading, token, shop]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary, #0f0f1a)',
        color: 'var(--text-primary, #fff)',
        fontSize: '1.1rem',
        gap: '12px',
      }}>
        <span style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>📡</span>
        Loading WiFi Drop…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      {route === 'login' && <ShopLogin />}
      {route === 'register' && <ShopRegister />}
      {route === 'mobile' && <MobileView />}
      {route === 'dashboard' && <LaptopView />}
    </>
  );
}

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}
