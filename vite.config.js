/**
 * client/vite.config.js
 * Vite configuration — dev proxy to backend, build output settings
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = 'http://127.0.0.1:3000';

function quietProxyErrors(proxy) {
  proxy.on('error', (err, _req, res) => {
    // Common when backend restarts or browser refreshes mid-socket — not a app bug
    if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
      return;
    }
    console.warn('[vite proxy]', err.message);
    if (res && !res.headersSent) {
      res.writeHead(502);
      res.end('Backend unavailable — is server running on port 3000?');
    }
  });
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist/build/pdf.js'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        configure: quietProxyErrors,
      },
      '/socket.io': {
        target: BACKEND,
        ws: true,
        changeOrigin: true,
        configure: quietProxyErrors,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
