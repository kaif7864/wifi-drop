/**
 * client/src/components/Sidebar.jsx
 * Dashboard Sidebar component — Logo, Server Status, QR Code
 */

import { QRDisplay } from './QRDisplay';
import { config } from '../config';

export function Sidebar({ connected, peerState, connectedDevice, sessionId }) {
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

      {/* QR Code Display */}
      <QRDisplay connectedDevice={connectedDevice} sessionId={sessionId} />
    </aside>
  );
}
