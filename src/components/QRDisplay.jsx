/**
 * client/src/components/QRDisplay.jsx
 * Shows the QR code for mobile connection + server IP URL
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { config } from '../config';

export function QRDisplay({ connectedDevice, sessionId }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQR = async () => {
      try {
        const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : '';
        const res = await axios.get(`${config.serverUrl}/api/qr${query}`);
        setQrData(res.data);
      } catch (err) {
        setError('Could not load QR code');
      } finally {
        setLoading(false);
      }
    };
    fetchQR();
  }, [sessionId]);

  return (
    <div className="qr-display glass-card">
      <div className="qr-header">
        <span className="section-title">📱 Scan to Connect</span>
        {connectedDevice ? (
          <div className="flex items-center gap-2">
            <span className="dot dot-success" />
            <span className="connected-label">{connectedDevice.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="dot dot-muted" />
            <span className="waiting-label">Waiting...</span>
          </div>
        )}
      </div>

      <div className="qr-code-wrapper">
        {loading && (
          <div className="qr-skeleton">
            <div className="skeleton-pulse" />
          </div>
        )}
        {error && <p className="qr-error">{error}</p>}
        {qrData && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="qr-image-container"
          >
            <img
              src={qrData.qrDataUrl}
              alt="Scan this QR code on your mobile to connect"
              className="qr-image"
            />
            <div className="qr-glow" />
          </motion.div>
        )}
      </div>

      {qrData && (
        <div className="qr-url">
          <span className="url-label">Mobile URL</span>
          <code className="url-text">{qrData.url}</code>
        </div>
      )}

      <style>{`
        .qr-display {
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .qr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .connected-label {
          font-size: var(--font-size-xs);
          color: var(--success);
          font-weight: 500;
        }
        .waiting-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        .qr-code-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
        }
        .qr-image-container {
          position: relative;
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .qr-image {
          width: 200px;
          height: 200px;
          border-radius: var(--radius-md);
          display: block;
        }
        .qr-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
          pointer-events: none;
          z-index: -1;
          animation: qr-pulse 3s ease-in-out infinite;
        }
        @keyframes qr-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .qr-skeleton {
          width: 200px;
          height: 200px;
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .skeleton-pulse {
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            var(--bg-tertiary) 0%,
            var(--bg-glass-hover) 50%,
            var(--bg-tertiary) 100%
          );
          background-size: 200% 100%;
          animation: skeleton-anim 1.5s infinite;
        }
        @keyframes skeleton-anim {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .qr-error {
          color: var(--danger);
          font-size: var(--font-size-sm);
          text-align: center;
        }
        .qr-url {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-3);
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }
        .url-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .url-text {
          font-size: var(--font-size-xs);
          color: var(--accent-secondary);
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
