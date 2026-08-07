/**
 * client/src/config.js
 * Client-side configuration — reads from Vite env vars (VITE_ prefix)
 * In development: proxy to localhost:3000
 * In production: same-origin (served by Express)
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export const config = {
  serverUrl: SERVER_URL,
  appName: import.meta.env.VITE_APP_NAME || 'WiFi Drop',
  socketPath: '/socket.io',
};
