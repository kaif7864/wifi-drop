/**
 * client/src/config.js
 * Client-side configuration — reads from Vite env vars (VITE_ prefix)
 */

const DEFAULT_SERVER_URL = 'https://wifi-drop-server.onrender.com';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : DEFAULT_SERVER_URL
);

export const config = {
  serverUrl: SERVER_URL,
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
