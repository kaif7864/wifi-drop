/**
 * client/src/components/Sidebar.jsx
 * Dashboard Sidebar component — Logo, Server Status, Interactive QR Trigger
 */

import { useState } from 'react';
import { QRModal } from './QRModal';
import { config } from '../config';

export function Sidebar({ connected, peerState, connectedDevice, sessionId, shop }) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  return (
    <aside className="laptop-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-icon">📡</span>
        <div>
          <h1 className="logo-title">{config.appName}</h1>
          <p className="logo-sub">Local & Cloud Transfer Hub</p>
        </div>
      </div>

      {/* Server & Hybrid status */}
      <div className="server-status glass-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`dot ${connected ? 'dot-success' : 'dot-muted'}`} />
            <span className="status-text">
              {connected ? 'Server Online' : 'Connecting...'}
            </span>
          </div>
          {peerState === 'connected' && (
            <span className="badge badge-success">P2P WebRTC Direct</span>
          )}
        </div>
      </div>

      {/* Interactive QR Trigger Card */}
      <div className="qr-trigger-card glass-card" onClick={() => setIsQrModalOpen(true)}>
        <div className="flex items-center gap-3">
          <div className="qr-icon-badge">📱</div>
          <div className="qr-trigger-info">
            <h4 className="qr-trigger-title">Scan & Drop QR</h4>
            <p className="qr-trigger-sub">
              {connectedDevice ? `📱 ${connectedDevice.name}` : 'Click to view scannable QR'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-xs qr-open-btn">
          Open QR ↗
        </button>
      </div>

      {/* Interactive Glassmorphic QR Modal */}
      <QRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        sessionId={sessionId}
        shopName={shop?.shopName}
        shopId={shop?.shopId}
      />

      <style>{`
        .qr-trigger-card {
          padding: var(--space-4) var(--space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          border: 1px solid var(--border-accent);
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-light) 100%);
          transition: all 0.2s ease;
        }
        .qr-trigger-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(79, 70, 229, 0.15);
          border-color: var(--accent-primary);
        }
        .qr-icon-badge {
          font-size: 1.5rem;
          background: #ffffff;
          padding: 8px;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }
        .qr-trigger-title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--text-primary);
        }
        .qr-trigger-sub {
          font-size: 11px;
          color: var(--text-muted);
        }
        .qr-open-btn {
          flex-shrink: 0;
        }
      `}</style>
    </aside>
  );
}
