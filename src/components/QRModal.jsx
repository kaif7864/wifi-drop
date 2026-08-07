/**
 * client/src/components/QRModal.jsx
 * Interactive Glassmorphic Modal for QR Code & Printable Standee Display
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../config';
import { QRStandee } from './QRStandee';

export function QRModal({ isOpen, onClose, sessionId, shopName, shopId }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('qr'); // 'qr' | 'standee'

  useEffect(() => {
    if (!isOpen) return;
    const fetchQR = async () => {
      setLoading(true);
      try {
        const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : '';
        const res = await axios.get(`${config.serverUrl}/api/qr${query}`);
        setQrData(res.data);
      } catch (err) {
        console.error('Failed to load QR:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQR();
  }, [isOpen, sessionId]);

  const handleCopyLink = async () => {
    if (qrData?.url) {
      await navigator.clipboard.writeText(qrData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="qr-modal-overlay" onClick={onClose}>
        <motion.div
          className="qr-modal-card glass-card"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="qr-modal-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="modal-icon">📱</span>
              <h3 className="modal-title">Mobile Connect QR</h3>
            </div>
            <button className="btn-icon" onClick={onClose} title="Close Modal">✕</button>
          </div>

          {/* Mode Switcher */}
          <div className="qr-modal-tabs flex gap-2">
            <button
              className={`tab-chip ${viewMode === 'qr' ? 'active' : ''}`}
              onClick={() => setViewMode('qr')}
            >
              📱 Digital QR Code
            </button>
            <button
              className={`tab-chip ${viewMode === 'standee' ? 'active' : ''}`}
              onClick={() => setViewMode('standee')}
            >
              🖨️ Counter Standee
            </button>
          </div>

          {/* Body */}
          <div className="qr-modal-body">
            {viewMode === 'qr' ? (
              <div className="qr-digital-view">
                {loading ? (
                  <div className="qr-loading">Generating QR Code…</div>
                ) : qrData ? (
                  <>
                    <div className="qr-img-wrapper">
                      <img src={qrData.qrDataUrl} alt="Connect QR" className="qr-img" />
                    </div>
                    <p className="qr-instruction">Scan with any Mobile Camera / Scanner</p>
                    
                    <div className="qr-copy-bar flex items-center justify-between">
                      <span className="url-preview">{qrData.url}</span>
                      <button className="btn btn-primary btn-sm" onClick={handleCopyLink}>
                        {copied ? '✓ Copied' : '📋 Copy Link'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="error-text">Could not load QR code.</p>
                )}
              </div>
            ) : (
              <QRStandee
                shopName={shopName || 'WiFi Drop Transfer'}
                shopId={shopId || sessionId}
                mobileUrl={qrData?.url}
                qrCodeUrl={qrData?.qrDataUrl}
              />
            )}
          </div>
        </motion.div>

        <style>{`
          .qr-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            z-index: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
          }
          .qr-modal-card {
            width: 100%;
            max-width: 440px;
            padding: var(--space-6);
            background: #ffffff;
            border-radius: var(--radius-xl);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
          .qr-modal-header {
            margin-bottom: var(--space-4);
          }
          .modal-icon { font-size: 1.5rem; }
          .modal-title {
            font-size: var(--font-size-lg);
            font-weight: 700;
          }
          .qr-modal-tabs {
            margin-bottom: var(--space-5);
            background: var(--bg-tertiary);
            padding: 4px;
            border-radius: var(--radius-full);
          }
          .tab-chip {
            flex: 1;
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-full);
            border: none;
            background: transparent;
            font-size: var(--font-size-xs);
            font-weight: 600;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .tab-chip.active {
            background: #ffffff;
            color: var(--accent-primary);
            box-shadow: var(--shadow-sm);
          }
          .qr-digital-view {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-4);
          }
          .qr-img-wrapper {
            padding: var(--space-4);
            background: #f8fafc;
            border-radius: var(--radius-lg);
            border: 1px solid var(--border);
          }
          .qr-img {
            width: 200px;
            height: 200px;
            display: block;
          }
          .qr-instruction {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-weight: 500;
          }
          .qr-copy-bar {
            width: 100%;
            padding: var(--space-2) var(--space-3);
            background: var(--bg-tertiary);
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
          }
          .url-preview {
            font-size: 11px;
            color: var(--text-secondary);
            font-family: monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 220px;
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
}
