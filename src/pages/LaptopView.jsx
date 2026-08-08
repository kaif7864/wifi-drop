/**
 * client/src/pages/LaptopView.jsx
 * Multi-Page Professional Dashboard — 8 Core Pages
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
import { CustomerFolders } from '../components/CustomerFolders';
import { QRStandee } from '../components/QRStandee';
import { config } from '../config';
import { playNotificationSound } from '../utils/audio';
import { t } from '../utils/i18n';

// New page components
import { DashboardPage } from './dashboard/DashboardPage';
import { PrintPage } from './dashboard/PrintPage';
import { CustomersPage } from './dashboard/CustomersPage';
import { BillingPage } from './dashboard/BillingPage';
import { AnalyticsPage } from './dashboard/AnalyticsPage';
import { QRManagementPage } from './dashboard/QRManagementPage';
import { SettingsPage } from './dashboard/SettingsPage';

function getOrCreateSessionId() {
  let id = localStorage.getItem('wifidrop_session_id');
  if (!id) {
    id = `wd_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('wifidrop_session_id', id);
  }
  return id;
}

// Page title mapping
const PAGE_TITLES = {
  dashboard: '📊 Dashboard',
  customer_folders: '📂 Customer Folders',
  files: '📄 All Files Stream',
  texts: '📝 Text Notes',
  print: '🖨️ Print Management',
  billing: '💳 Billing & Invoicing',
  customers: '👥 Customer Management',
  analytics: '📊 Reports & Analytics',
  qr_management: '📱 QR Code Manager',
  history: '📜 Full History',
  standee: '🖼️ Counter Standee',
  settings: '⚙️ Shop Settings',
};

export function LaptopView() {
  const { shop, logout } = useAuth();
  const sessionId = useMemo(() => shop?.shopId || getOrCreateSessionId(), [shop]);
  const { socket, connected } = useSocket('laptop', shop ? shop.shopName : 'Laptop Dashboard', sessionId);

  const {
    files, texts,
    addReceivedFile, addReceivedText,
    deleteFile, deleteText,
    deleteCustomerFolder,
    togglePrintStatus,
    fetchHistory,
  } = useTransfer();

  const unprintedCount = useMemo(() => files.filter((f) => !f.printedStatus).length, [files]);

  const { peerState } = useWebRTC({
    socket,
    sessionId,
    role: 'laptop',
    onFileReceived: addReceivedFile,
  });

  const { toasts, addToast, dismiss } = useToast();
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [qrUrl, setQrUrl] = useState('');
  const [lang, setLang] = useState(() => localStorage.getItem('wifidrop_lang') || 'en');

  // Fetch existing history on mount & auto-sync when laptop turns ON or comes back online (WhatsApp Store & Forward)
  useEffect(() => {
    if (!sessionId) return;

    // 1. Initial fetch on mount
    fetchHistory(sessionId);

    // 2. Periodic background sync every 10 seconds to catch offline uploads
    const interval = setInterval(() => {
      fetchHistory(sessionId);
    }, 10000);

    // 3. Window focus / laptop wake-up sync
    const handleFocus = () => fetchHistory(sessionId);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchHistory, sessionId]);

  // Sync history immediately whenever WebSocket reconnects
  useEffect(() => {
    if (connected && sessionId) {
      fetchHistory(sessionId);
    }
  }, [connected, sessionId, fetchHistory]);

  // Fetch QR code URL for standee page
  useEffect(() => {
    fetch(`${config.serverUrl}/api/qr?session=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => { if (data.success) setQrUrl(data.qrDataUrl); })
      .catch(() => {});
  }, [sessionId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const onFileReceived = (fileRecord) => {
      addReceivedFile(fileRecord);
      playNotificationSound();
      addToast({ type: 'success', title: '📁 File Received', message: `"${fileRecord.originalName}" from ${fileRecord.deviceName}` });
    };
    const onTextReceived = (textRecord) => {
      addReceivedText(textRecord);
      playNotificationSound();
      addToast({ type: 'info', title: '📝 Text Received', message: `From ${textRecord.deviceName}` });
    };
    const onDeviceConnected = (device) => {
      setConnectedDevice(device);
      addToast({ type: 'success', title: '📱 Device Connected', message: `${device.name} joined` });
    };
    const onDeviceDisconnected = (device) => {
      setConnectedDevice(null);
      addToast({ type: 'info', title: 'Device Disconnected', message: `${device.name} left` });
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

  const filteredTexts = useMemo(() =>
    texts.filter((t) =>
      t.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.deviceName?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [texts, searchQuery]);

  const combinedHistory = useMemo(() => {
    const fileItems = files.map((f) => ({ ...f, itemType: 'file', timestamp: new Date(f.savedAt || f.createdAt).getTime() }));
    const textItems = texts.map((t) => ({ ...t, itemType: 'text', timestamp: new Date(t.receivedAt || t.createdAt).getTime() }));
    return [...fileItems, ...textItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [files, texts]);

  const totalStorageSize = useMemo(() => files.reduce((acc, curr) => acc + (curr.size || 0), 0), [files]);

  // Show search for text-heavy views
  const showSearch = ['files', 'texts', 'history'].includes(activeNav);

  return (
    <div className="laptop-layout">
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        filesCount={files.length}
        unprintedCount={unprintedCount}
        textsCount={texts.length}
        historyCount={combinedHistory.length}
        connected={connected}
        peerState={peerState}
        connectedDevice={connectedDevice}
        sessionId={sessionId}
        shop={shop}
      />

      <main className="laptop-main">
        {/* Header Bar */}
        <div className="main-header flex items-center justify-between">
          <div className="page-heading">
            <h2 className="view-title">{PAGE_TITLES[activeNav] || 'Dashboard'}</h2>
          </div>

          <div className="flex items-center gap-3">
            {showSearch && <SearchBar value={searchQuery} onChange={setSearchQuery} />}

            {shop ? (
              <div className="shop-badge flex items-center gap-2">
                <span className="shop-name">🏪 {shop.shopName}</span>
                <button className="btn btn-ghost btn-xs" onClick={logout}>Logout</button>
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

        {/* Page Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNav}
            className="content-area"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── 0. DASHBOARD ── */}
            {activeNav === 'dashboard' && (
              <DashboardPage
                files={files}
                texts={texts}
                onNavChange={setActiveNav}
                sessionId={sessionId}
                shop={shop}
              />
            )}

            {/* ── 1. CUSTOMER FOLDERS ── */}
            {activeNav === 'customer_folders' && (
              <CustomerFolders
                files={files}
                texts={texts}
                onDeleteFile={deleteFile}
                onDeleteText={deleteText}
                onDeleteFolder={deleteCustomerFolder}
                onTogglePrint={togglePrintStatus}
                sessionId={sessionId}
                shop={shop}
              />
            )}

            {/* ── 2. ALL FILES ── */}
            {activeNav === 'files' && (
              <>
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
                        <FileCard
                          key={file.uuid || file.id || file._id}
                          file={file}
                          onDelete={deleteFile}
                          onTogglePrint={togglePrintStatus}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

            {/* ── 3. TEXT NOTES ── */}
            {activeNav === 'texts' && (
              filteredTexts.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">💬</span>
                  <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No text messages received yet</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Send text, links, or notes from mobile UI</p>
                </div>
              ) : (
                <div className="file-list">
                  <AnimatePresence mode="popLayout">
                    {filteredTexts.map((t) => (
                      <TextShare key={t.uuid || t.id || t._id} textRecord={t} onDelete={deleteText} />
                    ))}
                  </AnimatePresence>
                </div>
              )
            )}

            {/* ── 4. PRINT MANAGEMENT ── */}
            {activeNav === 'print' && (
              <PrintPage files={files} onTogglePrint={togglePrintStatus} shop={shop} />
            )}

            {/* ── 5. BILLING ── */}
            {activeNav === 'billing' && (
              <BillingPage files={files} texts={texts} shop={shop} />
            )}

            {/* ── 6. CUSTOMERS ── */}
            {activeNav === 'customers' && (
              <CustomersPage files={files} texts={texts} onNavChange={setActiveNav} onDeleteFolder={deleteCustomerFolder} />
            )}

            {/* ── 7. ANALYTICS ── */}
            {activeNav === 'analytics' && (
              <AnalyticsPage files={files} texts={texts} />
            )}

            {/* ── 8. QR MANAGEMENT ── */}
            {activeNav === 'qr_management' && (
              <QRManagementPage sessionId={sessionId} shop={shop} files={files} />
            )}

            {/* ── 9. HISTORY ── */}
            {activeNav === 'history' && (
              <TimelineHistory
                combinedHistory={combinedHistory}
                onDeleteFile={deleteFile}
                onDeleteText={deleteText}
                onTogglePrint={togglePrintStatus}
              />
            )}

            {/* ── 10. STANDEE ── */}
            {activeNav === 'standee' && (
              <div className="flex flex-col items-center justify-center">
                <div className="standee-wrapper">
                  <QRStandee
                    shopName={shop?.shopName || 'Shop Counter'}
                    shopId={shop?.shopId || sessionId}
                    mobileUrl={`${config.serverUrl}/mobile?shop=${shop?.shopId || sessionId}`}
                    qrCodeUrl={qrUrl}
                  />
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                      🖨️ Print Counter Standee
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 11. SETTINGS ── */}
            {activeNav === 'settings' && (
              <SettingsPage shop={shop} sessionId={sessionId} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <NotificationContainer toasts={toasts} onDismiss={dismiss} />

      <style>{`
        .laptop-layout {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .laptop-sidebar {
          width: 260px;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: var(--space-5) var(--space-4);
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
          margin-bottom: var(--space-2);
        }

        .logo-icon { font-size: 1.8rem; }
        .logo-title { font-size: var(--font-size-lg); font-weight: 800; color: var(--text-primary); }
        .logo-sub { font-size: 11px; color: var(--text-muted); }

        .server-status { padding: var(--space-3) var(--space-4); }
        .status-text { font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 500; }

        .laptop-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 100vh;
        }

        .main-header {
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          gap: var(--space-4);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .view-title {
          font-size: 1.05rem;
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
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-xs { padding: 3px 8px; font-size: 11px; border-radius: var(--radius-md); }
        .header-auth-btn { padding: 7px 14px; font-size: var(--font-size-xs); font-weight: 600; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 6px; }

        .content-area {
          flex: 1;
          padding: 1.5rem 2rem;
          overflow-y: auto;
        }

        .file-list { display: flex; flex-direction: column; gap: var(--space-3); }
        .standee-wrapper { width: 100%; max-width: 360px; margin: 0 auto; }
        .mt-4 { margin-top: var(--space-4); }
      `}</style>
    </div>
  );
}
