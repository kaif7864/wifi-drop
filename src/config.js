/**
 * client/src/config.js
 * Client-side configuration
 * Dynamic server URL resolution for local LAN Wi-Fi and live production backend
 */

function resolveServerUrl() {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    // Served from Express (port 3000) or production — same origin
    if (port === '3000' || !port) {
      return origin;
    }
    // Vite dev (5173): same origin so /api + /socket.io use the dev proxy
    if (port === '5173') {
      return origin;
    }
    const isLan =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.');
    if (isLan) {
      return `${protocol}//${hostname}:3000`;
    }
  }
  return 'https://wifi-drop-server.onrender.com';
}

export const config = {
  serverUrl: resolveServerUrl(),
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
