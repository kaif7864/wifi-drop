/**
 * client/src/config.js
 * Client-side configuration
 * In local dev: empty string (uses Vite proxy to http://localhost:3000)
 * In production: reads VITE_SERVER_URL or falls back to live server
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);

const SERVER_URL = isLocalhost
  ? (import.meta.env.VITE_SERVER_URL || '')
  : (import.meta.env.VITE_SERVER_URL || 'https://wifi-drop-server.onrender.com');

export const config = {
  serverUrl: SERVER_URL,
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
