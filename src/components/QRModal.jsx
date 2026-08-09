/**
 * client/src/components/QRModal.jsx
 * Interactive Glassmorphic Modal for QR Code, Folder-Specific Direct QR & Printable Standee
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../config';
import { QRStandee } from './QRStandee';
import { generateClientQR } from '../utils/qr';

export function QRModal({
  isOpen,
  onClose,
  sessionId,
  shopName,
  shopId,
  customerId,
  targetCustomerId,
}) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('qr'); // 'qr' | 'standee'

  const effectiveCustId = customerId || targetCustomerId;

  useEffect(() => {
    if (!isOpen) return;
    const fetchQR = async () => {
      setLoading(true);
      const queryParts = [];
      if (sessionId) queryParts.push(`session=${encodeURIComponent(sessionId)}`);
      const targetShop = shopId || (sessionId && !sessionId.startsWith('wd_') ? sessionId : null);
      if (targetShop && targetShop !== 'default') queryParts.push(`shop=${encodeURIComponent(targetShop)}`);
      if (effectiveCustId) queryParts.push(`customerId=${encodeURIComponent(effectiveCustId)}`);
      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      try {
        // 1. Fetch real Wi-Fi IP address URL from backend /api/qr
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
  }, [isOpen, sessionId, shopId, effectiveCustId]);

  const handleCopyLink = async () => {
    if (qrData?.url) {
      try {
        await navigator.clipboard.writeText(qrData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="qr-modal-overlay" onClick={onClose}>
        <motion.div
          className="qr-modal-card glass-card"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="qr-modal-header flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="modal-icon-badge" style={{ background: effectiveCustId ? '#ECFDF5' : '#EEF2FF', color: effectiveCustId ? '#059669' : '#4F46E5' }}>
                {effectiveCustId ? '📂' : '📱'}
              </div>
              <div className="min-w-0">
                <h3 className="modal-title">
                  {effectiveCustId ? 'Customer Folder QR' : 'Mobile Connect QR'}
                </h3>
                <p className="modal-subtitle">
                  {effectiveCustId
                    ? `Direct upload to: ${shopName || effectiveCustId}`
                    : (shopName ? `Shop: ${shopName}` : 'Instant Transfer')}
                </p>
              </div>
            </div>
            <button className="btn-icon qr-close-icon" onClick={onClose} title="Close Modal">✕</button>
          </div>

          {/* Mode Switcher (Hide Standee for Folder-Specific QR) */}
          {!effectiveCustId && (
            <div className="qr-modal-tabs flex gap-2">
              <button
                className={`tab-chip ${viewMode === 'qr' ? 'active' : ''}`}
                onClick={() => setViewMode('qr')}
              >
                📱 Digital QR
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
            {viewMode === 'qr' || effectiveCustId ? (
              <div className="qr-digital-view">
                {loading ? (
                  <div className="qr-loading">Generating QR Code…</div>
                ) : qrData ? (
                  <>
                    <div className={`qr-img-wrapper ${effectiveCustId ? 'folder-qr-wrapper' : ''}`}>
                      <img src={qrData.qrDataUrl} alt="Connect QR" className="qr-img" />
                      {effectiveCustId && (
                        <div className="folder-qr-target-badge">
                          <span>📂 {shopName || effectiveCustId}</span>
                        </div>
                      )}
                    </div>

                    <div className="qr-instruction-box text-center">
                      <p className="qr-instruction">
                        {effectiveCustId
                          ? `Scan with phone to upload directly into this folder`
                          : 'Scan with any phone camera / scanner to connect'}
                      </p>
                    </div>

                    <div className="qr-copy-card">
                      <div className="url-text" title={qrData.url}>{qrData.url}</div>
                      <button className="btn btn-primary btn-sm copy-btn" onClick={handleCopyLink}>
                        {copied ? '✓ Copied Link' : '📋 Copy Link'}
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
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            box-sizing: border-box;
          }

          .qr-modal-card {
            width: 100%;
            max-width: 420px;
            padding: 1.5rem;
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3);
            border: 1px solid #E2E8F0;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            box-sizing: border-box;
            max-height: 92vh;
            overflow-y: auto;
          }

          .qr-modal-header {
            width: 100%;
            gap: 8px;
          }

          .modal-icon-badge {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            flex-shrink: 0;
          }

          .modal-title {
            font-size: 1.05rem;
            font-weight: 800;
            color: #0F172A;
            line-height: 1.2;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .modal-subtitle {
            font-size: 0.76rem;
            font-weight: 600;
            color: #64748B;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .qr-close-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #F1F5F9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 800;
            color: #64748B;
            border: none;
            cursor: pointer;
            flex-shrink: 0;
          }

          .qr-close-icon:hover {
            background: #EF4444;
            color: white;
          }

          .qr-modal-tabs {
            background: #F1F5F9;
            padding: 4px;
            border-radius: 999px;
            display: flex;
            width: 100%;
          }

          .tab-chip {
            flex: 1;
            padding: 8px;
            border-radius: 999px;
            border: none;
            background: transparent;
            font-size: 0.78rem;
            font-weight: 700;
            color: #64748B;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s ease;
          }

          .tab-chip.active {
            background: #ffffff;
            color: #4F46E5;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          }

          .qr-digital-view {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            gap: 12px;
          }

          .qr-loading {
            padding: 2rem;
            color: #64748B;
            font-size: 0.85rem;
            font-weight: 600;
          }

          .qr-img-wrapper {
            background: #ffffff;
            padding: 14px;
            border-radius: 20px;
            border: 2px solid #E2E8F0;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.06);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
          }

          .qr-img-wrapper.folder-qr-wrapper {
            border-color: #059669;
            background: #F0FDF4;
          }

          .qr-img {
            width: 200px;
            height: 200px;
            display: block;
            border-radius: 10px;
          }

          .folder-qr-target-badge {
            margin-top: 8px;
            background: #059669;
            color: white;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 999px;
            max-width: 210px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .qr-instruction-box {
            width: 100%;
          }

          .qr-instruction {
            font-size: 0.8rem;
            font-weight: 600;
            color: #334155;
            line-height: 1.4;
            margin: 0;
          }

          .qr-copy-card {
            width: 100%;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 14px;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            box-sizing: border-box;
          }

          .url-text {
            font-size: 11px;
            color: #475569;
            font-family: monospace;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            min-width: 0;
          }

          .copy-btn {
            flex-shrink: 0;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 12px;
          }

          /* ── Mobile Responsive Breakpoints (<480px) ── */
          @media (max-width: 480px) {
            .qr-modal-overlay {
              padding: 0.625rem;
            }

            .qr-modal-card {
              padding: 1.15rem 1rem;
              border-radius: 20px;
            }

            .modal-title {
              font-size: 0.95rem;
            }

            .modal-icon-badge {
              width: 36px;
              height: 36px;
              font-size: 1.1rem;
            }

            .qr-img {
              width: 170px;
              height: 170px;
            }

            .qr-copy-card {
              flex-direction: column;
              align-items: stretch;
              gap: 8px;
              padding: 8px 10px;
            }

            .url-text {
              text-align: center;
              font-size: 10px;
            }

            .copy-btn {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>,
    document.body
  );
}
