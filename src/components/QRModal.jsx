/**
 * client/src/components/QRModal.jsx
 * Interactive Glassmorphic Modal for QR Code & Printable Standee Display
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../config';
import { QRStandee } from './QRStandee';
import { generateClientQR } from '../utils/qr';

export function QRModal({ isOpen, onClose, sessionId, shopName, shopId, customerId }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('qr'); // 'qr' | 'standee'

  useEffect(() => {
    if (!isOpen) return;
    const fetchQR = async () => {
      setLoading(true);
      const queryParts = [];
      if (sessionId) queryParts.push(`session=${encodeURIComponent(sessionId)}`);
      if (customerId) queryParts.push(`customerId=${encodeURIComponent(customerId)}`);
      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      try {
        // 1. Fetch real Wi-Fi IP address URL from backend /api/qr (e.g. http://10.120.60.171:5173/mobile...)
        const res = await axios.get(`${config.serverUrl}/api/qr${query}`);
        if (res.data && res.data.url) {
          const lanUrl = res.data.url;
          const qrImage = await generateClientQR(lanUrl);
          setQrData({
            qrDataUrl: qrImage || res.data.qrDataUrl,
            url: lanUrl,
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[QR Fetch Warning]:', err.message);
      }

      // 2. Fallback only if backend /api/qr is unreachable
      const host = window.location.origin;
      const fallbackUrl = `${host}/mobile${query}`;
      const fallbackQr = await generateClientQR(fallbackUrl);
      setQrData({ qrDataUrl: fallbackQr, url: fallbackUrl });
      setLoading(false);
    };
    fetchQR();
  }, [isOpen, sessionId, customerId]);

  const handleCopyLink = async () => {
    if (qrData?.url) {
      await navigator.clipboard.writeText(qrData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return createPortal(
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
              <span className="modal-icon">{customerId ? '📂' : '📱'}</span>
              <div>
                <h3 className="modal-title">
                  {customerId ? `Folder QR: ${shopName}` : 'Mobile Connect QR'}
                </h3>
                {customerId && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    🎯 Target ID: {customerId}
                  </p>
                )}
              </div>
            </div>
            <button className="btn-icon" onClick={onClose} title="Close Modal">✕</button>
          </div>

          {/* Mode Switcher (Hide Standee for Folder-Specific QR) */}
          {!customerId && (
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
          )}

          {/* Body */}
          <div className="qr-modal-body">
            {viewMode === 'qr' || customerId ? (
              <div className="qr-digital-view">
                {loading ? (
                  <div className="qr-loading">Generating Folder QR Code…</div>
                ) : qrData ? (
                  <>
                    <div className="qr-img-wrapper" style={{ border: customerId ? '2px solid var(--accent-primary)' : '1px solid var(--border)' }}>
                      <img src={qrData.qrDataUrl} alt="Connect QR" className="qr-img" />
                    </div>
                    <div className="text-center">
                      <p className="qr-instruction" style={{ fontWeight: 600, color: customerId ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {customerId
                          ? `Scan from any phone to upload directly into "${shopName}"`
                          : 'Scan with any Mobile Camera / Scanner'}
                      </p>
                    </div>
                    
                    <div className="qr-copy-bar flex items-center justify-between">
                      <span className="url-preview" title={qrData.url}>{qrData.url}</span>
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
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            z-index: 99999;
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
          .qr-loading {
            padding: var(--space-8);
            text-align: center;
            color: var(--text-muted);
            font-size: var(--font-size-sm);
          }
          .qr-digital-view {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            text-align: center;
            gap: 0.75rem;
          }
          .qr-img-wrapper {
            background: #ffffff;
            padding: 16px;
            border-radius: var(--radius-xl);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          }
          .qr-img {
            width: 210px;
            height: 210px;
            display: block;
          }
          .qr-instruction {
            font-size: var(--font-size-xs);
            color: var(--text-secondary);
            text-align: center;
            margin: 0 auto;
          }
          .qr-copy-bar {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: var(--bg-tertiary);
            padding: 8px 12px;
            border-radius: var(--radius-lg);
            border: 1px solid var(--border);
            margin-top: 6px;
          }
          .url-preview {
            font-size: 11px;
            color: var(--text-secondary);
            font-family: monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 230px;
          }
        `}</style>
      </div>
    </AnimatePresence>,
    document.body
  );
}
