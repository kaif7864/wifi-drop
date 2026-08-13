/**
 * client/src/components/QRStandee.jsx
 * Printable Counter QR Standee component for Shop Owners
 * Auto-generates QR code client-side if server QR URL is pending
 */

import { useState, useEffect } from 'react';
import { generateClientQR } from '../utils/qr';
import { toast } from '../context/ToastContext';

export function QRStandee({ shopName, shopId, sessionId, mobileUrl, qrCodeUrl, qrDataUrl }) {
  const [localQr, setLocalQr] = useState(qrCodeUrl || qrDataUrl || null);

  const cleanShop = shopId || (sessionId && !sessionId.startsWith('wd_') ? sessionId : null);
  const displayUrl = mobileUrl || (cleanShop && cleanShop !== 'default' 
    ? `${window.location.origin}/mobile?shop=${encodeURIComponent(cleanShop)}`
    : `${window.location.origin}/mobile?session=${encodeURIComponent(sessionId || 'default')}`
  );

  useEffect(() => {
    if (qrCodeUrl || qrDataUrl) {
      setLocalQr(qrCodeUrl || qrDataUrl);
      return;
    }
    generateClientQR(displayUrl).then((url) => {
      if (url) setLocalQr(url);
    });
  }, [qrCodeUrl, qrDataUrl, displayUrl]);

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    if (!localQr) return;

    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 1040;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Card dimensions
    const cardX = 50;
    const cardY = 40;
    const cardW = 700;
    const cardH = 960;
    const cardR = 36;

    // Helper: Rounded Rect
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // Draw Card Background & Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#FFFFFF';
    roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    // Card Border
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 5;
    roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.stroke();

    // Badge Pill
    const badgeW = 280;
    const badgeH = 40;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 95;
    ctx.fillStyle = '#EEF2FF';
    roundRect(badgeX, badgeY, badgeW, badgeH, 20);
    ctx.fill();
    ctx.strokeStyle = '#C7D2FE';
    ctx.lineWidth = 1.5;
    roundRect(badgeX, badgeY, badgeW, badgeH, 20);
    ctx.stroke();

    ctx.fillStyle = '#4F46E5';
    ctx.font = '800 16px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ INSTANT PRINT DROP', width / 2, badgeY + 25);

    // Shop Name
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 38px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText(shopName || 'Shop Counter', width / 2, 195);

    // Subtitle
    ctx.fillStyle = '#64748B';
    ctx.font = '600 20px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('Scan to Send Files & Documents', width / 2, 235);

    // QR Inner Box
    const qrBoxW = 460;
    const qrBoxH = 460;
    const qrBoxX = (width - qrBoxW) / 2;
    const qrBoxY = 275;
    ctx.fillStyle = '#F8FAFC';
    roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
    ctx.stroke();

    // Draw QR image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const qrImgW = 390;
      const qrImgH = 390;
      const qrImgX = (width - qrImgW) / 2;
      const qrImgY = qrBoxY + (qrBoxH - qrImgH) / 2;
      ctx.drawImage(img, qrImgX, qrImgY, qrImgW, qrImgH);

      // URL
      ctx.fillStyle = '#4F46E5';
      ctx.font = 'bold 20px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(displayUrl, width / 2, 805);

      // Security Tag
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 18px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('🔒 No Cable · No Login · Direct Drop', width / 2, 850);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `Counter_Standee_${(shopName || 'Shop').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = localQr;
  }

  return (
    <div className="standee-wrapper-container">
      {/* Printable Standee Card */}
      <div className="standee-card printable-standee-target">
        <div className="standee-header">
          <span className="standee-badge">⚡ INSTANT PRINT DROP</span>
          <h2 className="standee-shop">{shopName || 'Shop Counter'}</h2>
          <p className="standee-sub">Scan to Send Files & Documents</p>
        </div>

        <div className="standee-qr-box">
          {localQr ? (
            <img src={localQr} alt="Counter QR Code" className="standee-qr" />
          ) : (
            <div className="standee-placeholder">Generating QR…</div>
          )}
        </div>

        <div className="standee-footer">
          <p className="standee-url">{displayUrl}</p>
          <span className="standee-tag">🔒 No Cable · No Login · Direct Drop</span>
        </div>
      </div>

      {/* Standee Action Controls Toolbar */}
      <div className="standee-actions-toolbar">
        <button
          type="button"
          className="standee-action-btn primary"
          onClick={handlePrint}
        >
          <span>🖨️</span> Print Standee
        </button>
        <button
          type="button"
          className="standee-action-btn secondary"
          onClick={handleDownload}
        >
          <span>📥</span> Download
        </button>
        <button
          type="button"
          className="standee-action-btn secondary"
          onClick={() => {
            navigator.clipboard.writeText(displayUrl);
            toast.copy('Standee link copied to clipboard!');
          }}
        >
          <span>🔗</span> Copy Link
        </button>
      </div>

      <style>{`
        .standee-wrapper-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0 1.5rem;
        }

        .standee-card {
          padding: 1.6rem 1.4rem;
          background: #FFFFFF;
          border: 2px solid #4F46E5;
          border-radius: 24px;
          text-align: center;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          box-shadow: 0 10px 30px -4px rgba(15, 23, 42, 0.1);
          box-sizing: border-box;
        }

        .standee-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          color: #4F46E5;
          background: #EEF2FF;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid #C7D2FE;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .standee-shop {
          font-size: 1.2rem;
          font-weight: 900;
          color: #0F172A;
          margin: 0;
        }

        .standee-sub {
          font-size: 0.76rem;
          color: #64748B;
          margin: 4px 0 12px;
          font-weight: 600;
        }

        .standee-qr-box {
          background: #F8FAFC;
          padding: 12px;
          border-radius: 18px;
          display: inline-block;
          border: 1.5px solid #E2E8F0;
          margin-bottom: 10px;
        }

        .standee-qr {
          width: 175px;
          height: 175px;
          display: block;
        }

        .standee-placeholder {
          width: 175px;
          height: 175px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.78rem;
          color: #94A3B8;
        }

        .standee-footer {
          margin-top: 2px;
        }

        .standee-url {
          font-size: 11px;
          font-weight: 700;
          color: #4F46E5;
          word-break: break-all;
          margin: 0 0 4px;
        }

        .standee-tag {
          display: block;
          font-size: 10px;
          font-weight: 700;
          color: #94A3B8;
        }

        /* ── 3 Distinct Action Buttons (NOT a tab bar) ── */
        .standee-actions-toolbar {
          width: 100%;
          max-width: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          background: transparent;
          border: none;
          padding: 0;
          box-shadow: none;
        }

        .standee-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 10px;
          border-radius: 12px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex: 1;
        }

        .standee-action-btn.primary {
          background: #4F46E5;
          color: #FFFFFF;
          border: 1px solid #4338CA;
          box-shadow: 0 3px 10px rgba(79, 70, 229, 0.28);
        }

        .standee-action-btn.primary:hover {
          background: #4338CA;
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(79, 70, 229, 0.35);
        }

        .standee-action-btn.secondary {
          background: #FFFFFF;
          color: #1E293B;
          border: 1.5px solid #CBD5E1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .standee-action-btn.secondary:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
        }

        .standee-action-btn:active {
          transform: translateY(0);
        }

        .standee-card {
          padding: 1.75rem 1.5rem;
          background: #FFFFFF;
          border: 2px solid #4F46E5;
          border-radius: 24px;
          text-align: center;
          width: 100%;
          max-width: 330px;
          margin: 0 auto;
          box-shadow: 0 12px 36px -4px rgba(15, 23, 42, 0.12);
          box-sizing: border-box;
        }

        .standee-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          color: #4F46E5;
          background: #EEF2FF;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid #C7D2FE;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .standee-shop {
          font-size: 1.25rem;
          font-weight: 900;
          color: #0F172A;
          margin: 0;
        }

        .standee-sub {
          font-size: 0.78rem;
          color: #64748B;
          margin: 4px 0 14px;
          font-weight: 600;
        }

        .standee-qr-box {
          background: #F8FAFC;
          padding: 14px;
          border-radius: 18px;
          display: inline-block;
          border: 1.5px solid #E2E8F0;
          margin-bottom: 12px;
        }

        .standee-qr {
          width: 180px;
          height: 180px;
          display: block;
        }

        .standee-placeholder {
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.78rem;
          color: #94A3B8;
        }

        .standee-footer {
          margin-top: 4px;
        }

        .standee-url {
          font-size: 11px;
          font-weight: 700;
          color: #4F46E5;
          word-break: break-all;
          margin: 0 0 4px;
        }

        .standee-tag {
          display: block;
          font-size: 10px;
          font-weight: 700;
          color: #94A3B8;
        }

        /* ── Isolated Exact Standee Printing (Hides entire dashboard UI) ── */
        @media print {
          @page {
            margin: 0;
            size: auto;
          }

          html, body {
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .printable-standee-target,
          .printable-standee-target * {
            visibility: visible !important;
          }

          .printable-standee-target {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) scale(1.15) !important;
            margin: 0 !important;
            border: 2.5px solid #4F46E5 !important;
            box-shadow: none !important;
            background: #FFFFFF !important;
            width: 320px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }

          .standee-actions-toolbar,
          .main-header,
          .laptop-sidebar,
          .mobile-bottom-nav,
          .toast-container {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
