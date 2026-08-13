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
    // If client is served directly from backend port (e.g. port 3000)
    if (port === '3000' || !port) {
      return origin;
    }
    // If client is served from Vite dev server (e.g. port 5173), point to backend port 3000
    return `${protocol}//${hostname}:3000`;
  }
  return 'http://localhost:3000';
}

export const config = {
  serverUrl: resolveServerUrl(),
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
