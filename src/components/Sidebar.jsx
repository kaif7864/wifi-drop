/**
 * client/src/components/Sidebar.jsx
 * Multi-Page Sidebar Navigation — 8 Core Pages with Mobile Responsive Drawer Support
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
  isOpen = false,
  onClose,
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

  const handleNavClick = (id) => {
    onNavChange(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`laptop-sidebar ${isOpen ? 'mobile-open' : ''}`}>
        {/* Logo & Mobile Close */}
        <div className="sidebar-logo">
          <div className="flex items-center gap-3">
            <span className="logo-icon">📡</span>
            <div>
              <h1 className="logo-title">{config.appName}</h1>
              <p className="logo-sub">{shop ? shop.shopName : 'Transfer Hub'}</p>
            </div>
          </div>
          {onClose && (
            <button
              className="btn-icon mobile-sidebar-close-btn"
              onClick={onClose}
              title="Close Menu"
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
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
                  onClick={() => handleNavClick(item.id)}
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
          .mobile-sidebar-backdrop {
            display: none;
          }

          .mobile-sidebar-close-btn {
            display: none;
          }

          .sidebar-logo {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3);
            padding-bottom: var(--space-4);
            border-bottom: 1px solid var(--border);
            margin-bottom: var(--space-2);
          }

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

          .server-status {
            padding: 10px 14px;
            background: #FFFFFF;
            border: 1px solid var(--border);
            border-radius: var(--radius-full);
            margin-top: auto;
            display: flex;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }

          .server-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
            margin-left: 2px;
          }

          .server-status .status-text {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-primary);
            white-space: nowrap;
          }

          .mt-auto { margin-top: auto; }

          /* ── Mobile Responsive Sidebar (<1024px) ── */
          @media (max-width: 1024px) {
            .mobile-sidebar-backdrop {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(15, 23, 42, 0.5);
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              z-index: 100;
              animation: fadeIn 0.2s ease;
            }

            .mobile-sidebar-close-btn {
              display: inline-flex;
              font-size: 14px;
              width: 32px;
              height: 32px;
              border-radius: 8px;
            }

            .laptop-sidebar {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              bottom: 0 !important;
              height: 100vh !important;
              width: 280px !important;
              max-width: 85vw !important;
              z-index: 110 !important;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2) !important;
              transform: translateX(-100%);
              transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }

            .laptop-sidebar.mobile-open {
              transform: translateX(0) !important;
            }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </aside>
    </>
  );
}
