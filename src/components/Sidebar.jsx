/**
 * client/src/components/Sidebar.jsx
 * Multi-Page Sidebar Navigation — 8 Core Pages
 */

import { useState } from 'react';
import { QRModal } from './QRModal';
import { config } from '../config';

export function Sidebar({
  activeNav,
  onNavChange,
  filesCount = 0,
  unprintedCount = 0,
  textsCount = 0,
  historyCount = 0,
  connected,
  peerState,
  connectedDevice,
  sessionId,
  shop,
}) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const navGroups = [
    {
      label: 'OVERVIEW',
      items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      ],
    },
    {
      label: 'FILE MANAGEMENT',
      items: [
        { id: 'customer_folders', icon: '📂', label: 'Customer Folders', count: unprintedCount },
        { id: 'files', icon: '📄', label: 'All Files', count: filesCount },
        { id: 'texts', icon: '📝', label: 'Text Notes', count: textsCount },
      ],
    },
    {
      label: 'SHOP TOOLS',
      items: [
        { id: 'print', icon: '🖨️', label: 'Print Management', count: unprintedCount },
        { id: 'billing', icon: '💳', label: 'Billing & Invoicing' },
        { id: 'customers', icon: '👥', label: 'Customers' },
      ],
    },
    {
      label: 'INSIGHTS',
      items: [
        { id: 'analytics', icon: '📊', label: 'Reports & Analytics' },
        { id: 'qr_management', icon: '📱', label: 'QR Management' },
        { id: 'history', icon: '📜', label: 'Full History', count: historyCount },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { id: 'standee', icon: '🖼️', label: 'Counter Standee' },
        { id: 'settings', icon: '⚙️', label: 'Shop Settings' },
      ],
    },
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

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label} className="nav-group">
            <p className="nav-group-label">{group.label}</p>
            {group.items.map((item) => (
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
          </div>
        ))}
      </nav>

      {/* QR Trigger */}
      <div className="qr-trigger-card glass-card" onClick={() => setIsQrModalOpen(true)}>
        <div className="flex items-center gap-3">
          <div className="qr-icon-badge">📱</div>
          <div className="qr-trigger-info">
            <h4 className="qr-trigger-title">Scan & Drop QR</h4>
            <p className="qr-trigger-sub">
              {connectedDevice ? `📱 ${connectedDevice.name}` : 'Click to open QR'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-xs qr-open-btn">QR ↗</button>
      </div>

      {/* Server Status */}
      <div className="server-status glass-card mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`dot ${connected ? 'dot-success' : 'dot-muted'}`} />
            <span className="status-text">{connected ? 'Server Online' : 'Connecting...'}</span>
          </div>
          {peerState === 'connected' && (
            <span className="badge badge-success" style={{ fontSize: '10px' }}>P2P</span>
          )}
        </div>
      </div>

      <QRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        sessionId={sessionId}
        shopName={shop?.shopName}
        shopId={shop?.shopId}
      />

      <style>{`
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-2) 0;
        }

        .nav-group {
          margin-bottom: var(--space-4);
        }

        .nav-group-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          padding: 0 var(--space-3) var(--space-1);
          text-transform: uppercase;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 9px var(--space-4);
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
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

        .nav-icon { font-size: 1rem; flex-shrink: 0; }
        .nav-label { flex: 1; }

        .nav-badge {
          background: var(--danger);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
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
          margin: var(--space-3) 0;
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

        .mt-auto { margin-top: auto; }
      `}</style>
    </aside>
  );
}
