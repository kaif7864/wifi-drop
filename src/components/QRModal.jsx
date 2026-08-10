/**
 * client/src/components/QRModal.jsx
 * State-of-the-Art Interactive Glassmorphic QR Modal
 * Ultra-Modern UI with Dynamic QR Toggle (Upload ↔ Time-Limited View Portal), Standee Mode & Instant Sharing
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
  isViewOnly = false,
}) {
  const [qrPurpose, setQrPurpose] = useState(() => (isViewOnly ? 'view' : 'upload')); // 'upload' | 'view'
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('qr'); // 'qr' | 'standee'
  const [viewExpiry, setViewExpiry] = useState('4h');

  const effectiveCustId = customerId || targetCustomerId;

  // Sync initial purpose when modal opens
  useEffect(() => {
    if (isOpen) {
      setQrPurpose(isViewOnly ? 'view' : 'upload');
      setViewMode('qr');
    }
  }, [isOpen, isViewOnly]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchQR = async () => {
      setLoading(true);
      const targetShop = shopId || (sessionId && !sessionId.startsWith('wd_') && !sessionId.startsWith('temp_') ? sessionId : null);

      try {
        let activeSessionId = sessionId;

        // If creating a View-Only QR and not already a temp session, generate an expired-safe temp session
        if (qrPurpose === 'view' && (!sessionId || !sessionId.startsWith('temp_'))) {
          try {
            const tempRes = await axios.post(`${config.serverUrl}/api/qr/temp`, {
              customerName: shopName || effectiveCustId || 'Customer View',
              expiry: viewExpiry,
              shopId: targetShop || 'default',
              mode: 'view_only',
              isViewOnly: true,
              targetCustomerId: effectiveCustId || null,
            });
            if (tempRes.data?.qr?.qrId) {
              activeSessionId = tempRes.data.qr.qrId;
            }
          } catch {}
        }

        const queryParts = [];
        if (activeSessionId) queryParts.push(`session=${encodeURIComponent(activeSessionId)}`);
        if (targetShop && targetShop !== 'default') queryParts.push(`shop=${encodeURIComponent(targetShop)}`);
        if (effectiveCustId) queryParts.push(`customerId=${encodeURIComponent(effectiveCustId)}`);
        if (qrPurpose === 'view') queryParts.push('view=only');
        const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

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
      } catch {
        // fallback
      }

      // 2. Fallback only if backend /api/qr is unreachable
      const host = window.location.origin;
      const fallbackQueryParts = [];
      if (sessionId) fallbackQueryParts.push(`session=${encodeURIComponent(sessionId)}`);
      if (targetShop && targetShop !== 'default') fallbackQueryParts.push(`shop=${encodeURIComponent(targetShop)}`);
      if (effectiveCustId) fallbackQueryParts.push(`customerId=${encodeURIComponent(effectiveCustId)}`);
      if (qrPurpose === 'view') fallbackQueryParts.push('view=only');
      const fallbackQuery = fallbackQueryParts.length > 0 ? `?${fallbackQueryParts.join('&')}` : '';

      const fallbackUrl = `${host}/mobile${fallbackQuery}`;
      const fallbackQr = await generateClientQR(fallbackUrl);
      setQrData({ qrDataUrl: fallbackQr, url: fallbackUrl });
      setLoading(false);
    };
    fetchQR();
  }, [isOpen, sessionId, shopId, effectiveCustId, qrPurpose, viewExpiry]);

  const handleCopyLink = async () => {
    if (qrData?.url) {
      try {
        await navigator.clipboard.writeText(qrData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  if (!isOpen) return null;

  const isView = qrPurpose === 'view';

  return createPortal(
    <AnimatePresence>
      <div className="qr-modal-overlay" onClick={onClose}>
        <motion.div
          className="qr-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="qr-modal-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`modal-avatar ${isView ? 'avatar-view' : 'avatar-upload'}`}>
                {isView ? '👁️' : effectiveCustId ? '📂' : '⚡'}
              </div>
              <div className="min-w-0">
                <h3 className="modal-title">
                  {isView
                    ? 'Time-Limited View Portal QR'
                    : effectiveCustId
                    ? 'Folder Upload QR'
                    : 'Shop Connect QR'}
                </h3>
                <p className="modal-subtitle">
                  {isView
                    ? `Expires after ${viewExpiry} • ${shopName || effectiveCustId || 'Shop'}`
                    : effectiveCustId
                    ? `Direct upload into: ${shopName || effectiveCustId}`
                    : `Permanent Standee • ${shopName || 'WiFi Drop Transfer'}`}
                </p>
              </div>
            </div>
            <button className="qr-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          {/* Standee View Mode */}
          {viewMode === 'standee' ? (
            <div className="standee-wrapper">
              <div className="flex justify-between items-center mb-3">
                <button className="btn btn-ghost btn-sm" onClick={() => setViewMode('qr')}>
                  ← Back to QR
                </button>
                <span className="standee-label">Printable Counter Standee</span>
              </div>
              <QRStandee
                shopName={shopName || 'WiFi Drop Transfer'}
                shopId={shopId || sessionId}
                mobileUrl={qrData?.url}
                qrCodeUrl={qrData?.qrDataUrl}
              />
            </div>
          ) : (
            /* Digital QR View Mode */
            <div className="qr-body-content">
              {/* Segmented Mode Selector */}
              <div className="segmented-toggle-bar">
                <button
                  type="button"
                  className={`segment-btn ${!isView ? 'active-upload' : ''}`}
                  onClick={() => setQrPurpose('upload')}
                >
                  <span className="btn-icon-label">📤</span>
                  <span>Upload QR (No History)</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${isView ? 'active-view' : ''}`}
                  onClick={() => setQrPurpose('view')}
                >
                  <span className="btn-icon-label">👁️</span>
                  <span>View-Only QR (Expires)</span>
                </button>
              </div>

              {/* Expiry Selector when in View Mode */}
              {isView && (
                <div className="view-expiry-selector flex items-center justify-between gap-2 w-full">
                  <span className="expiry-label">⏱️ Link Expiry Time:</span>
                  <div className="flex items-center gap-1.5">
                    {['1h', '4h', '24h', '72h'].map((exp) => (
                      <button
                        key={exp}
                        type="button"
                        className={`expiry-chip ${viewExpiry === exp ? 'active-exp' : ''}`}
                        onClick={() => setViewExpiry(exp)}
                      >
                        {exp === '1h' ? '1 Hour' : exp === '4h' ? '4 Hours' : exp === '24h' ? '1 Day' : '3 Days'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QR Image Container */}
              <div className="qr-display-box">
                {loading ? (
                  <div className="qr-skeleton-loader">
                    <div className="spinner"></div>
                    <span>Generating Secure QR...</span>
                  </div>
                ) : qrData ? (
                  <div className="qr-canvas-wrap">
                    <div className={`qr-frame ${isView ? 'frame-view' : 'frame-upload'}`}>
                      <img src={qrData.qrDataUrl} alt="Connect QR Code" className="qr-image-tag" />
                    </div>

                    {/* Mode Tag Pill */}
                    <div className={`mode-indicator-pill ${isView ? 'pill-view' : 'pill-upload'}`}>
                      <span className="pill-dot"></span>
                      <span>
                        {isView
                          ? `👁️ Time-Limited View Portal (${viewExpiry})`
                          : effectiveCustId
                          ? `📂 Upload to: ${shopName || effectiveCustId}`
                          : '⚡ Counter Upload Mode (Secure)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="error-text">Failed to generate QR code.</p>
                )}
              </div>

              {/* Instructional Text */}
              <p className="qr-helper-text">
                {isView
                  ? `Customer can view their files & print status for ${viewExpiry}. After that, access expires automatically.`
                  : effectiveCustId
                  ? 'Customer scans to upload files into this folder. Past historical files are hidden.'
                  : 'Customer scans at the counter to upload files. Past files will NOT be accessible.'}
              </p>

              {/* URL & Instant Action Bar */}
              <div className="qr-action-panel">
                <div className="url-preview-pill">
                  <span className="url-protocol-tag">URL</span>
                  <span className="url-preview-text" title={qrData?.url || ''}>
                    {qrData?.url || 'Generating link...'}
                  </span>
                </div>

                <div className="action-buttons-row">
                  <button
                    className={`btn-action-main ${isView ? 'btn-view-glow' : 'btn-upload-glow'}`}
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <span>✓</span>
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>{isView ? '👁️' : '📋'}</span>
                        <span>{isView ? `Copy View Link (${viewExpiry})` : 'Copy Upload Link'}</span>
                      </>
                    )}
                  </button>

                  {!effectiveCustId && (
                    <button
                      className="btn-action-secondary"
                      onClick={() => setViewMode('standee')}
                      title="Print Standee for Shop Counter"
                    >
                      🖨️ Standee
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <style>{`
          .qr-modal-overlay {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.76);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            box-sizing: border-box;
          }

          .qr-modal-card {
            width: 100%;
            max-width: 430px;
            background: #FFFFFF;
            border-radius: 26px;
            box-shadow: 0 30px 70px -10px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8);
            padding: 1.25rem 1.35rem;
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
            box-sizing: border-box;
            max-height: 94vh;
            overflow-y: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .qr-modal-card::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }

          .qr-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .modal-avatar {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.35rem;
            flex-shrink: 0;
            transition: all 0.2s ease;
          }

          .avatar-upload {
            background: #EEF2FF;
            color: #4F46E5;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
          }

          .avatar-view {
            background: #F3E8FF;
            color: #7C3AED;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
          }

          .modal-title {
            font-size: 1.12rem;
            font-weight: 900;
            color: #0F172A;
            line-height: 1.2;
            letter-spacing: -0.01em;
          }

          .modal-subtitle {
            font-size: 0.76rem;
            color: #64748B;
            margin-top: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 280px;
          }

          .qr-close-btn {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 1px solid #E2E8F0;
            background: #F8FAFC;
            color: #64748B;
            font-size: 0.85rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            flex-shrink: 0;
          }

          .qr-close-btn:hover {
            background: #F1F5F9;
            color: #0F172A;
            transform: scale(1.05);
          }

          .qr-body-content {
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
            align-items: center;
          }

          .segmented-toggle-bar {
            width: 100%;
            background: #F1F5F9;
            padding: 4px;
            border-radius: 16px;
            display: flex;
            gap: 4px;
            border: 1px solid #E2E8F0;
          }

          .segment-btn {
            flex: 1;
            padding: 8px 10px;
            font-size: 0.8rem;
            font-weight: 800;
            border-radius: 12px;
            border: none;
            background: transparent;
            color: #64748B;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .segment-btn.active-upload {
            background: #FFFFFF;
            color: #4F46E5;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.14), 0 1px 3px rgba(0, 0, 0, 0.05);
          }

          .segment-btn.active-view {
            background: #FFFFFF;
            color: #7C3AED;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.14), 0 1px 3px rgba(0, 0, 0, 0.05);
          }

          .view-expiry-selector {
            background: #FAF5FF;
            border: 1px solid #E9D5FF;
            border-radius: 12px;
            padding: 6px 10px;
          }

          .expiry-label {
            font-size: 0.72rem;
            font-weight: 800;
            color: #7C3AED;
          }

          .expiry-chip {
            font-size: 0.68rem;
            font-weight: 700;
            padding: 3px 7px;
            border-radius: 6px;
            border: 1px solid transparent;
            background: transparent;
            color: #6B21A8;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .expiry-chip.active-exp {
            background: #7C3AED;
            color: #FFFFFF;
            box-shadow: 0 2px 6px rgba(124, 58, 237, 0.3);
          }

          .qr-display-box {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .qr-canvas-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }

          .qr-frame {
            background: #FFFFFF;
            padding: 10px;
            border-radius: 20px;
            box-shadow: 0 10px 28px rgba(15, 23, 42, 0.07);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .frame-upload {
            border: 2.5px solid #EEF2FF;
          }
          .frame-upload:hover {
            border-color: #C7D2FE;
            box-shadow: 0 14px 36px rgba(79, 70, 229, 0.14);
          }

          .frame-view {
            border: 2.5px solid #F3E8FF;
          }
          .frame-view:hover {
            border-color: #DDD6FE;
            box-shadow: 0 14px 36px rgba(124, 58, 237, 0.14);
          }

          .qr-image-tag {
            width: 160px;
            height: 160px;
            display: block;
            border-radius: 10px;
          }

          .mode-indicator-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 800;
          }

          .pill-upload {
            background: #EEF2FF;
            color: #4F46E5;
            border: 1px solid #C7D2FE;
          }

          .pill-view {
            background: #F3E8FF;
            color: #7C3AED;
            border: 1px solid #DDD6FE;
          }

          .pill-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 1.6s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
          }

          .qr-helper-text {
            font-size: 0.76rem;
            color: #64748B;
            text-align: center;
            line-height: 1.4;
            margin: 0;
            padding: 0 10px;
          }

          .qr-action-panel {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 18px;
            padding: 12px;
            box-sizing: border-box;
          }

          .url-preview-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 6px 10px;
            overflow: hidden;
          }

          .url-protocol-tag {
            font-size: 0.65rem;
            font-weight: 900;
            background: #F1F5F9;
            color: #475569;
            padding: 2px 6px;
            border-radius: 5px;
            letter-spacing: 0.05em;
          }

          .url-preview-text {
            font-size: 0.72rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #475569;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
          }

          .action-buttons-row {
            display: flex;
            gap: 8px;
            width: 100%;
          }

          .btn-action-main {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 800;
            border: none;
            color: #FFFFFF;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .btn-upload-glow {
            background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
          }
          .btn-upload-glow:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
          }

          .btn-view-glow {
            background: linear-gradient(135deg, #7C3AED 0%, #9333EA 100%);
            box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
          }
          .btn-view-glow:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
          }

          .btn-action-secondary {
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 0.82rem;
            font-weight: 700;
            border: 1px solid #E2E8F0;
            background: #FFFFFF;
            color: #334155;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
          }
          .btn-action-secondary:hover {
            background: #F1F5F9;
            color: #0F172A;
          }

          .qr-skeleton-loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 2.5rem;
            font-size: 0.82rem;
            color: #64748B;
            font-weight: 600;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #E2E8F0;
            border-top-color: #4F46E5;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </AnimatePresence>,
    document.body
  );
}
