/**
 * client/src/components/QRStandee.jsx
 * Printable Counter QR Standee component for Shop Owners
 */

export function QRStandee({ shopName, shopId, mobileUrl, qrCodeUrl }) {
  return (
    <div className="standee-card glass-card">
      <div className="standee-header">
        <span className="standee-badge">⚡ INSTANT PRINT DROP</span>
        <h2 className="standee-shop">{shopName || 'Shop Counter'}</h2>
        <p className="standee-sub">Scan to Send Files & Documents</p>
      </div>

      <div className="standee-qr-box">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="Counter QR Code" className="standee-qr" />
        ) : (
          <div className="standee-placeholder">Generating QR…</div>
        )}
      </div>

      <div className="standee-footer">
        <p className="standee-url">{mobileUrl || `wifi-drop.com/mobile?shop=${shopId}`}</p>
        <span className="standee-tag">🔒 No Cable · No Login · Direct Drop</span>
      </div>

      <style>{`
        .standee-card {
          padding: var(--space-6);
          background: #ffffff;
          border: 2px solid var(--accent-primary);
          border-radius: var(--radius-xl);
          text-align: center;
          max-width: 320px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }
        .standee-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-primary);
          background: var(--accent-light);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          letter-spacing: 0.5px;
          margin-bottom: var(--space-2);
        }
        .standee-shop {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--text-primary);
        }
        .standee-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-bottom: var(--space-4);
        }
        .standee-qr-box {
          background: #f8fafc;
          padding: var(--space-4);
          border-radius: var(--radius-lg);
          display: inline-block;
          border: 1px solid var(--border);
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
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        .standee-footer {
          margin-top: var(--space-4);
        }
        .standee-url {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-primary);
          word-break: break-all;
        }
        .standee-tag {
          display: block;
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
