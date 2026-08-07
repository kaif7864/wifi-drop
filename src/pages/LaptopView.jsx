/**
 * client/src/pages/LaptopView.jsx
 * Main dashboard shown on laptop — QR code, received files, received texts, WebRTC P2P + Hybrid mode
 */

import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useWebRTC } from '../hooks/useWebRTC';
import { useToast, NotificationContainer } from '../components/Notification';
import { QRDisplay } from '../components/QRDisplay';
import { FileCard } from '../components/FileCard';
import { TextShare } from '../components/TextShare';
import { config } from '../config';

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('wifidrop_session_id');
  if (!id) {
    id = `wd_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('wifidrop_session_id', id);
  }
  return id;
}

export function LaptopView() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const { socket, connected } = useSocket('laptop', 'Laptop Dashboard', sessionId);
  
  const {
    files, texts,
    addReceivedFile, addReceivedText,
    deleteFile, deleteText,
    fetchHistory,
  } = useTransfer();

  const { peerState } = useWebRTC({
    socket,
    sessionId,
    role: 'laptop',
    onFileReceived: addReceivedFile,
  });

  const { toasts, addToast, dismiss } = useToast();
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'texts'

  // Fetch existing history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const onFileReceived = (fileRecord) => {
      addReceivedFile(fileRecord);
      addToast({
        type: 'success',
        title: '📁 File Received',
        message: `"${fileRecord.originalName}" from ${fileRecord.deviceName}`,
      });
    };

    const onTextReceived = (textRecord) => {
      addReceivedText(textRecord);
      addToast({
        type: 'info',
        title: '📝 Text Received',
        message: `From ${textRecord.deviceName}`,
      });
    };

    const onDeviceConnected = (device) => {
      setConnectedDevice(device);
      addToast({
        type: 'success',
        title: '📱 Device Connected',
        message: `${device.name} joined session ${sessionId}`,
      });
    };

    const onDeviceDisconnected = (device) => {
      setConnectedDevice(null);
      addToast({
        type: 'info',
        title: 'Device Disconnected',
        message: `${device.name} left`,
      });
    };

    const onUploadError = ({ message }) => {
      addToast({ type: 'error', title: 'Upload Error', message });
    };

    socket.on('file_received', onFileReceived);
    socket.on('text_received', onTextReceived);
    socket.on('device_connected', onDeviceConnected);
    socket.on('device_disconnected', onDeviceDisconnected);
    socket.on('upload_error', onUploadError);

    return () => {
      socket.off('file_received', onFileReceived);
      socket.off('text_received', onTextReceived);
      socket.off('device_connected', onDeviceConnected);
      socket.off('device_disconnected', onDeviceDisconnected);
      socket.off('upload_error', onUploadError);
    };
  }, [socket, addReceivedFile, addReceivedText, addToast, sessionId]);

  return (
    <div className="laptop-layout">
      {/* ── Sidebar ── */}
      <aside className="laptop-sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="logo-icon">📡</span>
          <div>
            <h1 className="logo-title">{config.appName}</h1>
            <p className="logo-sub">Hybrid local & cloud transfer</p>
          </div>
        </div>

        {/* Server & Hybrid status */}
        <div className="server-status glass-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`dot ${connected ? 'dot-success' : 'dot-muted'}`} />
              <span className="status-text">
                {connected ? 'Ready (Local/Relay)' : 'Connecting...'}
              </span>
            </div>
            {peerState === 'connected' && (
              <span className="badge badge-success">P2P WebRTC Direct</span>
            )}
          </div>
        </div>

        {/* QR Code */}
        <QRDisplay connectedDevice={connectedDevice} sessionId={sessionId} />
      </aside>

      {/* ── Main content ── */}
      <main className="laptop-main">
        {/* Header */}
        <div className="main-header">
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'files' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              📁 Files
              {files.length > 0 && (
                <span className="tab-count">{files.length}</span>
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === 'texts' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('texts')}
            >
              📝 Texts
              {texts.length > 0 && (
                <span className="tab-count">{texts.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* File list */}
        {activeTab === 'files' && (
          <div className="content-area">
            {files.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📂</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  No files received yet
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Scan the QR code on your mobile to start sending files
                </p>
              </div>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onDelete={deleteFile}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Text list */}
        {activeTab === 'texts' && (
          <div className="content-area">
            {texts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">💬</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  No texts received yet
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Send a text or clipboard content from your mobile
                </p>
              </div>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {texts.map((t) => (
                    <TextShare
                      key={t.id}
                      textRecord={t}
                      onDelete={deleteText}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toasts */}
      <NotificationContainer toasts={toasts} onDismiss={dismiss} />

      <style>{`
        .laptop-layout {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }

        /* ── Sidebar ── */
        .laptop-sidebar {
          width: 320px;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          overflow-y: auto;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--border);
        }
        .logo-icon { font-size: 1.8rem; }
        .logo-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .logo-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }

        .server-status {
          padding: var(--space-3) var(--space-4);
        }
        .status-text {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          font-weight: 500;
        }

        /* ── Main content ── */
        .laptop-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .main-header {
          padding: var(--space-5) var(--space-8);
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .tab-bar {
          display: flex;
          gap: var(--space-2);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-5);
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .tab-btn:hover {
          background: var(--bg-glass);
          color: var(--text-primary);
        }

        .tab-active {
          background: var(--accent-glow) !important;
          border-color: var(--border-accent) !important;
          color: var(--accent-secondary) !important;
        }

        .tab-count {
          background: var(--accent-primary);
          color: #fff;
          border-radius: var(--radius-full);
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          min-width: 18px;
          text-align: center;
        }

        .content-area {
          flex: 1;
          padding: var(--space-6) var(--space-8);
          overflow-y: auto;
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
      `}</style>
    </div>
  );
}
