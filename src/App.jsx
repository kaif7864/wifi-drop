/**
 * client/src/App.jsx
 * Root component — detects if running on mobile or laptop
 * and renders the appropriate view
 */

import { LaptopView } from './pages/LaptopView';
import { MobileView } from './pages/MobileView';

/**
 * Simple route detection:
 * - /mobile → MobileView
 * - anything else → LaptopView
 */
function isMobileRoute() {
  return window.location.pathname === '/mobile';
}

export default function App() {
  if (isMobileRoute()) {
    return <MobileView />;
  }
  return <LaptopView />;
}
