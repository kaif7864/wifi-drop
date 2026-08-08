/**
 * client/src/config.js
 * Client-side configuration
 * Dynamic server URL resolution for local LAN Wi-Fi and live production backend
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);

const localBackendUrl = `${window.location.protocol}//${window.location.hostname}:3000`;

const SERVER_URL = isLocalhost
  ? (import.meta.env.VITE_SERVER_URL || localBackendUrl)
  : (import.meta.env.VITE_SERVER_URL || 'https://wifi-drop-server.onrender.com');

export const config = {
  serverUrl: SERVER_URL,
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
