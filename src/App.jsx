/**
 * client/src/App.jsx
 * Root component — Route switcher & AuthProvider wrapper
 */

import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { LaptopView } from './pages/LaptopView';
import { MobileView } from './pages/MobileView';
import { ShopLogin } from './pages/ShopLogin';
import { ShopRegister } from './pages/ShopRegister';

function getCurrentRoute() {
  const path = window.location.pathname;
  if (path === '/login') return 'login';
  if (path === '/register') return 'register';
  if (path === '/mobile') return 'mobile';
  return 'dashboard';
}

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <AuthProvider>
      {route === 'login' && <ShopLogin />}
      {route === 'register' && <ShopRegister />}
      {route === 'mobile' && <MobileView />}
      {route === 'dashboard' && <LaptopView />}
    </AuthProvider>
  );
}
