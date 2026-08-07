/**
 * client/src/components/Sidebar.jsx
 * Multi-Page Sidebar Navigation Component — Dedicated views for Files, Text, History, Standee, Analytics
 */

import { useState } from 'react';
import { QRModal } from './QRModal';
import { config } from '../config';

export function Sidebar({
  activeNav,
  onNavChange,
  filesCount,
  textsCount,
  historyCount,
  connected,
  peerState,
  connectedDevice,
  sessionId,
  shop,
}) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const navItems = [
    { id: 'files', icon: '📁', label: 'Received Files', count: filesCount },
    { id: 'texts', icon: '📝', label: 'Text Notes', count: textsCount },
    { id: 'history', icon: '📜', label: 'Full History', count: historyCount },
    { id: 'standee', icon: '🖨️', label: 'Counter QR Standee' },
    { id: 'analytics', icon: '📊', label: 'Analytics & Reports' },
  ];

  return (
    <aside className="laptop-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-icon">📡</span>
        <div>
          <h1 className="logo-title">{config.appName}</h1>
          <p className="logo-sub">{shop ? shop.shopName : 'Transfer Hub'}</p>
        </div>
      </div>

      {/* Navigation Menu Links */}
      <nav className="sidebar-nav flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.count > 0 && <span className="nav-badge">{item.count}</span>}
          </button>
        ))}
      </nav>

      {/* Interactive QR Trigger Card */}
      <div className="qr-trigger-card glass-card" onClick={() => setIsQrModalOpen(true)}>
        <div className="flex items-center gap-3">
          <div className="qr-icon-badge">📱</div>
          <div className="qr-trigger-info">
            <h4 className="qr-trigger-title">Scan & Drop QR</h4>
            <p className="qr-trigger-sub">
              {connectedDevice ? `📱 ${connectedDevice.name}` : 'Click for mobile QR'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-xs qr-open-btn">
          QR ↗
        </button>
      </div>

      {/* Server & Hybrid status */}
      <div className="server-status glass-card mt-auto">
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

      {/* Interactive Glassmorphic QR Modal */}
      <QRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        sessionId={sessionId}
        shopName={shop?.shopName}
        shopId={shop?.shopId}
      />

      <style>{`
        .sidebar-nav {
          margin: var(--space-4) 0;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          text-align: left;
        }

        .nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--accent-light);
          color: var(--accent-primary);
          border-left: 3px solid var(--accent-primary);
        }

        .nav-icon { font-size: 1.1rem; }

        .nav-label {
          flex: 1;
        }

        .nav-badge {
          background: var(--accent-primary);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: var(--radius-full);
        }

        .qr-trigger-card {
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          border: 1px solid var(--border-accent);
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-light) 100%);
          transition: all 0.2s ease;
          margin-top: var(--space-2);
        }

        .qr-trigger-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(79, 70, 229, 0.15);
          border-color: var(--accent-primary);
        }

        .qr-icon-badge {
          font-size: 1.3rem;
          background: #ffffff;
          padding: 6px;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .qr-trigger-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--text-primary);
        }

        .qr-trigger-sub {
          font-size: 10px;
          color: var(--text-muted);
        }

        .mt-auto {
          margin-top: auto;
        }
      `}</style>
    </aside>
  );
}
