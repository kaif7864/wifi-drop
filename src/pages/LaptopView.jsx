/**
 * client/src/pages/LaptopView.jsx
 * Comprehensive Dashboard — History, Files, Text Notes, Analytics & Device Controls
 */

import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'texts' | 'history' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all'); // 'all' | 'image' | 'doc' | 'media'

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

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch = f.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            f.deviceName?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (fileFilter === 'image') return f.mimeType?.startsWith('image/');
      if (fileFilter === 'doc') return f.mimeType?.includes('pdf') || f.mimeType?.includes('text') || f.mimeType?.includes('document');
      if (fileFilter === 'media') return f.mimeType?.startsWith('video/') || f.mimeType?.startsWith('audio/');
      return true;
    });
  }, [files, searchQuery, fileFilter]);

  // Filtered texts
  const filteredTexts = useMemo(() => {
    return texts.filter((t) =>
      t.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.deviceName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [texts, searchQuery]);

  // Combined timeline history
  const combinedHistory = useMemo(() => {
    const fileItems = files.map((f) => ({ ...f, itemType: 'file', timestamp: new Date(f.savedAt || f.createdAt).getTime() }));
    const textItems = texts.map((t) => ({ ...t, itemType: 'text', timestamp: new Date(t.receivedAt || t.createdAt).getTime() }));
    return [...fileItems, ...textItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [files, texts]);

  // Total storage calculate
  const totalStorageSize = useMemo(() => {
    return files.reduce((acc, curr) => acc + (curr.size || 0), 0);
  }, [files]);

  return (
    <div className="laptop-layout">
      {/* ── Sidebar ── */}
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

      {/* ── Main Dashboard Content ── */}
      <main className="laptop-main">
        {/* Header Bar */}
        <div className="main-header flex items-center justify-between">
          {/* Navigation Tabs */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'files' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              📁 Files
              {files.length > 0 && <span className="tab-count">{files.length}</span>}
            </button>
            <button
              className={`tab-btn ${activeTab === 'texts' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('texts')}
            >
              📝 Text Notes
              {texts.length > 0 && <span className="tab-count">{texts.length}</span>}
            </button>
            <button
              className={`tab-btn ${activeTab === 'history' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 Timeline
              {combinedHistory.length > 0 && <span className="tab-count">{combinedHistory.length}</span>}
            </button>
            <button
              className={`tab-btn ${activeTab === 'analytics' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📊 Stats
            </button>
          </div>

          {/* Live Search */}
          <div className="search-box">
            <input
              type="text"
              className="input search-input"
              placeholder="Search files, texts, devices…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Files Tab ── */}
        {activeTab === 'files' && (
          <div className="content-area">
            {/* Filter pills */}
            <div className="filter-bar flex items-center gap-2">
              <button className={`filter-chip ${fileFilter === 'all' ? 'active' : ''}`} onClick={() => setFileFilter('all')}>All Files</button>
              <button className={`filter-chip ${fileFilter === 'image' ? 'active' : ''}`} onClick={() => setFileFilter('image')}>🖼️ Images</button>
              <button className={`filter-chip ${fileFilter === 'doc' ? 'active' : ''}`} onClick={() => setFileFilter('doc')}>📄 Documents</button>
              <button className={`filter-chip ${fileFilter === 'media' ? 'active' : ''}`} onClick={() => setFileFilter('media')}>🎬 Audio/Video</button>
            </div>

            {filteredFiles.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📂</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  No files found
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Scan the QR code on mobile to start transferring files
                </p>
              </div>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {filteredFiles.map((file) => (
                    <FileCard key={file.id} file={file} onDelete={deleteFile} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── Text Notes Tab ── */}
        {activeTab === 'texts' && (
          <div className="content-area">
            {filteredTexts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">💬</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  No text messages received yet
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Send text, links, or notes from mobile UI
                </p>
              </div>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {filteredTexts.map((t) => (
                    <TextShare key={t.id} textRecord={t} onDelete={deleteText} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── Timeline History Tab ── */}
        {activeTab === 'history' && (
          <div className="content-area">
            {combinedHistory.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📜</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  Transfer History Empty
                </p>
              </div>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {combinedHistory.map((item) => (
                    item.itemType === 'file' ? (
                      <FileCard key={item.id} file={item} onDelete={deleteFile} />
                    ) : (
                      <TextShare key={item.id} textRecord={item} onDelete={deleteText} />
                    )
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics & Stats Tab ── */}
        {activeTab === 'analytics' && (
          <div className="content-area">
            <div className="analytics-grid">
              <div className="stat-card glass-card">
                <span className="stat-icon">📂</span>
                <div>
                  <h3 className="stat-value">{files.length}</h3>
                  <p className="stat-label">Total Files Received</p>
                </div>
              </div>
              <div className="stat-card glass-card">
                <span className="stat-icon">💬</span>
                <div>
                  <h3 className="stat-value">{texts.length}</h3>
                  <p className="stat-label">Total Text Notes</p>
                </div>
              </div>
              <div className="stat-card glass-card">
                <span className="stat-icon">💾</span>
                <div>
                  <h3 className="stat-value">{formatBytes(totalStorageSize)}</h3>
                  <p className="stat-label">Total Size Transferred</p>
                </div>
              </div>
              <div className="stat-card glass-card">
                <span className="stat-icon">🔑</span>
                <div>
                  <h3 className="stat-value">{sessionId}</h3>
                  <p className="stat-label">Current Session Code</p>
                </div>
              </div>
            </div>
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
          color: var(--text-primary);
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

        .laptop-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .main-header {
          padding: var(--space-4) var(--space-8);
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          gap: var(--space-4);
        }

        .tab-bar {
          display: flex;
          gap: var(--space-2);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
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
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .tab-active {
          background: var(--accent-light) !important;
          border-color: var(--border-accent) !important;
          color: var(--accent-primary) !important;
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

        .search-box {
          max-width: 280px;
          width: 100%;
        }

        .search-input {
          padding: var(--space-2) var(--space-4);
          font-size: var(--font-size-xs);
          border-radius: var(--radius-full);
        }

        .content-area {
          flex: 1;
          padding: var(--space-6) var(--space-8);
          overflow-y: auto;
        }

        .filter-bar {
          margin-bottom: var(--space-5);
        }

        .filter-chip {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .filter-chip:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .filter-chip.active {
          background: var(--accent-primary);
          color: #fff;
          border-color: var(--accent-primary);
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-5);
        }

        .stat-card {
          padding: var(--space-6);
          display: flex;
          align-items: center;
          gap: var(--space-5);
        }

        .stat-icon { font-size: 2.2rem; }
        .stat-value {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--text-primary);
        }
        .stat-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
