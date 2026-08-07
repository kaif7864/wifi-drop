/**
 * client/src/pages/LaptopView.jsx
 * Multi-View Dedicated Dashboard Page — Renders separate views for Files, Text, History, Standee, Analytics
 */

import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useWebRTC } from '../hooks/useWebRTC';
import { useToast, NotificationContainer } from '../components/Notification';
import { Sidebar } from '../components/Sidebar';
import { SearchBar } from '../components/SearchBar';
import { CategoryFilter } from '../components/CategoryFilter';
import { FileCard } from '../components/FileCard';
import { TextShare } from '../components/TextShare';
import { TimelineHistory } from '../components/TimelineHistory';
import { AnalyticsStats } from '../components/AnalyticsStats';
import { QRStandee } from '../components/QRStandee';
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
  const { shop, logout } = useAuth();
  const sessionId = useMemo(() => shop?.shopId || getOrCreateSessionId(), [shop]);
  const { socket, connected } = useSocket('laptop', shop ? shop.shopName : 'Laptop Dashboard', sessionId);
  
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
  const [activeNav, setActiveNav] = useState('files'); // 'files' | 'texts' | 'history' | 'standee' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all'); // 'all' | 'image' | 'doc' | 'media'
  const [qrUrl, setQrUrl] = useState('');

  // Fetch existing history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Fetch QR code URL for standee page
  useEffect(() => {
    fetch(`${config.serverUrl}/api/qr?session=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setQrUrl(data.qrDataUrl);
      })
      .catch(() => {});
  }, [sessionId]);

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

  // Filtered files calculation
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

  // Filtered texts calculation
  const filteredTexts = useMemo(() => {
    return texts.filter((t) =>
      t.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.deviceName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [texts, searchQuery]);

  // Combined timeline history calculation
  const combinedHistory = useMemo(() => {
    const fileItems = files.map((f) => ({ ...f, itemType: 'file', timestamp: new Date(f.savedAt || f.createdAt).getTime() }));
    const textItems = texts.map((t) => ({ ...t, itemType: 'text', timestamp: new Date(t.receivedAt || t.createdAt).getTime() }));
    return [...fileItems, ...textItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [files, texts]);

  // Total storage size calculation
  const totalStorageSize = useMemo(() => {
    return files.reduce((acc, curr) => acc + (curr.size || 0), 0);
  }, [files]);

  return (
    <div className="laptop-layout">
      {/* Sidebar Component */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        filesCount={files.length}
        textsCount={texts.length}
        historyCount={combinedHistory.length}
        connected={connected}
        peerState={peerState}
        connectedDevice={connectedDevice}
        sessionId={sessionId}
        shop={shop}
      />

      {/* Main Dashboard Content */}
      <main className="laptop-main">
        {/* Header Bar */}
        <div className="main-header flex items-center justify-between">
          <div className="page-heading">
            <h2 className="view-title">
              {activeNav === 'files' && '📁 Received Files Manager'}
              {activeNav === 'texts' && '📝 Text & Clipboard Notes'}
              {activeNav === 'history' && '📜 Full Transfer Timeline'}
              {activeNav === 'standee' && '🖨️ Counter QR Standee Studio'}
              {activeNav === 'analytics' && '📊 Transfer Analytics & Reports'}
            </h2>
          </div>

          {/* Search Input Bar Component & Auth Header */}
          <div className="flex items-center gap-3">
            {(activeNav === 'files' || activeNav === 'texts' || activeNav === 'history') && (
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            )}

            {shop ? (
              <div className="shop-badge flex items-center gap-2">
                <span className="shop-name">🏪 {shop.shopName}</span>
                <button className="btn btn-ghost btn-xs" onClick={logout} title="Logout Shop">
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-actions flex items-center gap-2">
                <a href="/login" className="btn btn-ghost btn-sm header-auth-btn">Shop Login</a>
                <a href="/register" className="btn btn-primary btn-sm header-auth-btn">
                  <span>🏪</span> Register Shop
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── 1. DEDICATED FILES PAGE ── */}
        {activeNav === 'files' && (
          <motion.div
            className="content-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CategoryFilter currentFilter={fileFilter} onFilterChange={setFileFilter} />

            {filteredFiles.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📂</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No files found</p>
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
          </motion.div>
        )}

        {/* ── 2. DEDICATED TEXT NOTES PAGE ── */}
        {activeNav === 'texts' && (
          <motion.div
            className="content-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {filteredTexts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">💬</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No text messages received yet</p>
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
          </motion.div>
        )}

        {/* ── 3. DEDICATED TIMELINE HISTORY PAGE ── */}
        {activeNav === 'history' && (
          <motion.div
            className="content-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TimelineHistory
              combinedHistory={combinedHistory}
              onDeleteFile={deleteFile}
              onDeleteText={deleteText}
            />
          </motion.div>
        )}

        {/* ── 4. DEDICATED COUNTER STANDEE PAGE ── */}
        {activeNav === 'standee' && (
          <motion.div
            className="content-area flex flex-col items-center justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="standee-wrapper">
              <QRStandee
                shopName={shop?.shopName || 'Shop Counter'}
                shopId={shop?.shopId || sessionId}
                mobileUrl={`${config.serverUrl}/mobile?shop=${shop?.shopId || sessionId}`}
                qrCodeUrl={qrUrl}
              />
              <div className="standee-actions flex items-center justify-center gap-3 mt-4">
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  🖨️ Print Counter Standee
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 5. DEDICATED ANALYTICS PAGE ── */}
        {activeNav === 'analytics' && (
          <motion.div
            className="content-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyticsStats
              filesCount={files.length}
              textsCount={texts.length}
              totalStorageSize={totalStorageSize}
              sessionId={sessionId}
            />
          </motion.div>
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
          width: 280px;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          overflow-y: auto;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }
        .logo-icon { font-size: 1.8rem; }
        .logo-title {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--text-primary);
        }
        .logo-sub {
          font-size: 11px;
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

        .view-title {
          font-size: var(--font-size-md);
          font-weight: 700;
          color: var(--text-primary);
        }

        .shop-badge {
          background: var(--accent-light);
          border: 1px solid var(--border-accent);
          padding: 6px 14px;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        .shop-name {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--accent-primary);
          white-space: nowrap;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-xs {
          padding: 2px 8px;
          font-size: 11px;
          border-radius: var(--radius-md);
        }

        .header-auth-btn {
          padding: 8px 16px;
          font-size: var(--font-size-xs);
          font-weight: 600;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .search-box {
          max-width: 240px;
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

        .file-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .standee-wrapper {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
        }

        .mt-4 { margin-top: var(--space-4); }
      `}</style>
    </div>
  );
}
