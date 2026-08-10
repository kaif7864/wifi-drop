/**
 * client/src/pages/LaptopView.jsx
 * Laptop / Desktop Dashboard View — Multi-Page SaaS Transfer Hub with Complete Mobile Responsiveness
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../App';
import { FileCard } from '../components/FileCard';
import { TextShare } from '../components/TextShare';
import { TimelineHistory } from '../components/TimelineHistory';
import { SearchBar } from '../components/SearchBar';
import { CategoryFilter } from '../components/CategoryFilter';
import { QRStandee } from '../components/QRStandee';
import { Sidebar } from '../components/Sidebar';
import { CustomerFolders } from '../components/CustomerFolders';
import { DashboardPage } from './dashboard/DashboardPage';
import { PrintPage } from './dashboard/PrintPage';
import { BillingPage } from './dashboard/BillingPage';
import { CustomersPage } from './dashboard/CustomersPage';
import { AnalyticsPage } from './dashboard/AnalyticsPage';
import { QRManagementPage } from './dashboard/QRManagementPage';
import { SettingsPage } from './dashboard/SettingsPage';
import { NotificationContainer } from '../components/Notification';
import { config } from '../config';
import { playNotificationSound } from '../utils/audio';

const PAGE_TITLES = {
  dashboard: '📊 Dashboard Overview',
  customer_folders: '📂 Customer Folders',
  files: '📄 All Files Stream',
  texts: '📝 Text Notes & Messages',
  print: '🖨️ Print Management',
  billing: '💳 Billing & POS Invoicing',
  customers: '👥 Customer CRM',
  analytics: '📊 Reports & Analytics',
  qr_management: '📱 Dynamic QR Management',
  history: '📜 Complete Activity History',
  standee: '🖼️ Counter Standee & Signage',
  settings: '⚙️ Store & Cloud Settings',
};

function getOrCreateSessionId() {
  let id = localStorage.getItem('wifidrop_session_id');
  if (!id) {
    id = `wd_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('wifidrop_session_id', id);
  }
  return id;
}

export function LaptopView() {
  const { shop, token, logout } = useAuth();
  const sessionId = useMemo(() => shop?.shopId || getOrCreateSessionId(), [shop]);
  const { socket, connected } = useSocket('laptop', shop ? shop.shopName : 'Laptop Dashboard', sessionId);

  const {
    files, texts,
    addReceivedFile, addReceivedText,
    deleteFile, deleteText,
    deleteCustomerFolder,
    togglePrintStatus,
    fetchHistory,
  } = useTransfer(shop?.shopId);

  const [toasts, setToasts] = useState([]);
  const [peerState] = useState('disconnected');
  const [connectedDevice] = useState(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedFolderCustomerId, setSelectedFolderCustomerId] = useState(null);

  // Derived shop/session identifiers — defined early so all hooks can access them
  const guestSessionId = useMemo(() => getOrCreateSessionId(), []);
  const activeShopId = shop?.shopId || null;
  const targetSessionId = activeShopId ? null : guestSessionId;

  // Track recent toast IDs and socket events to avoid duplicate alerts
  const recentToastIdsRef = useRef(new Map());
  const recentEventsRef = useRef(new Map());

  const addToast = useCallback((toast) => {
    const dedupeKey = toast.dedupeKey || toast.file?.uuid || toast.file?.id || toast.file?._id || toast.title;
    if (dedupeKey) {
      const lastTime = recentToastIdsRef.current.get(dedupeKey);
      if (lastTime && Date.now() - lastTime < 6000) {
        return; // Skip duplicate within 6 seconds
      }
      recentToastIdsRef.current.set(dedupeKey, Date.now());
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      if (toast.file) {
        const fid = toast.file.uuid || toast.file.id || toast.file._id;
        if (fid && prev.some((t) => (t.file?.uuid || t.file?.id || t.file?._id) === fid)) {
          return prev;
        }
      }
      return [...prev, { id, ...toast }];
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleLogout = useCallback(() => {
    setToasts([]);
    recentToastIdsRef.current.clear();
    recentEventsRef.current.clear();
    logout();
  }, [logout]);

  // Request browser notification permission on mount if enabled
  useEffect(() => {
    const notifEnabled = localStorage.getItem('wifidrop_notif_enabled') !== 'false';
    if (notifEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Listen for real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleFileReceived = (fileData) => {
      const fileId = fileData.uuid || fileData.id || fileData._id || `${fileData.originalName}_${fileData.size}`;
      const lastProcessed = recentEventsRef.current.get(`file_${fileId}`);
      if (lastProcessed && Date.now() - lastProcessed < 10000) {
        return; // Prevent duplicate notifications within 10 seconds
      }
      recentEventsRef.current.set(`file_${fileId}`, Date.now());

      addReceivedFile(fileData);

      const soundEnabled = localStorage.getItem('wifidrop_sound_enabled') !== 'false';
      const notifEnabled = localStorage.getItem('wifidrop_notif_enabled') !== 'false';

      if (soundEnabled) {
        playNotificationSound();
      }

      if (notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`📥 New File: ${fileData.originalName || 'Received File'}`, {
            body: `From: ${fileData.customerName || fileData.deviceName || 'Customer'}`,
            icon: '/favicon.ico',
          });
        } catch {}
      }

      addToast({
        dedupeKey: `file_${fileId || fileData.originalName}`,
        type: 'file',
        title: `📥 ${fileData.originalName}`,
        message: `${fileData.customerName || fileData.deviceName || 'Mobile'} transferred a file`,
        file: fileData,
      });
      // Backup: also re-fetch from server to catch any missed/mismatched socket events
      setTimeout(() => fetchHistory(activeShopId, targetSessionId, token), 1000);
    };

    const handleTextReceived = (textData) => {
      const textId = textData.uuid || textData.id || textData._id || `${textData.text?.slice(0, 15)}`;
      const lastProcessed = recentEventsRef.current.get(`text_${textId}`);
      if (lastProcessed && Date.now() - lastProcessed < 10000) {
        return;
      }
      recentEventsRef.current.set(`text_${textId}`, Date.now());

      addReceivedText(textData);

      const soundEnabled = localStorage.getItem('wifidrop_sound_enabled') !== 'false';
      const notifEnabled = localStorage.getItem('wifidrop_notif_enabled') !== 'false';

      if (soundEnabled) {
        playNotificationSound();
      }

      if (notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`💬 Note from ${textData.customerName || textData.deviceName || 'Customer'}`, {
            body: textData.text?.slice(0, 60),
            icon: '/favicon.ico',
          });
        } catch {}
      }

      addToast({
        dedupeKey: `text_${textId || textData.text?.slice(0, 20)}`,
        type: 'text',
        title: `💬 Note from ${textData.customerName || textData.deviceName || 'Mobile'}`,
        message: textData.text?.slice(0, 60),
      });
      // Backup: also re-fetch from server
      setTimeout(() => fetchHistory(activeShopId, targetSessionId, token), 1000);
    };

    socket.on('file_received', handleFileReceived);
    socket.on('text_received', handleTextReceived);

    return () => {
      socket.off('file_received', handleFileReceived);
      socket.off('text_received', handleTextReceived);
    };
  }, [socket, addReceivedFile, addReceivedText, addToast, fetchHistory, activeShopId, targetSessionId, token]);

  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [qrUrl, setQrUrl] = useState('');
  const [lang, setLang] = useState(() => localStorage.getItem('wifidrop_lang') || 'en');

  // Fetch existing history on mount & auto-sync
  useEffect(() => {
    fetchHistory(activeShopId, targetSessionId, token);

    const interval = setInterval(() => {
      fetchHistory(activeShopId, targetSessionId, token);
    }, 10000);

    const handleFocus = () => fetchHistory(activeShopId, targetSessionId, token);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchHistory, activeShopId, targetSessionId, token]);

  useEffect(() => {
    if (connected) {
      fetchHistory(activeShopId, targetSessionId, token);
    }
  }, [connected, activeShopId, targetSessionId, token, fetchHistory]);

  // Fetch QR code URL for standee page
  useEffect(() => {
    const shopQuery = shop?.shopId ? `&shop=${encodeURIComponent(shop.shopId)}` : '';
    fetch(`${config.serverUrl}/api/qr?session=${encodeURIComponent(sessionId)}${shopQuery}`)
      .then((res) => res.json())
      .then((data) => { if (data.success) setQrUrl(data.qrDataUrl); })
      .catch(() => {});
  }, [sessionId, shop]);

  // Filter files by category & search query
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const name = (file.originalName || file.name || '').toLowerCase();
      const devName = (file.deviceName || '').toLowerCase();
      const custName = (file.customerName || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || name.includes(q) || devName.includes(q) || custName.includes(q);

      if (!matchesSearch) return false;
      if (fileFilter === 'all') return true;

      const mime = (file.mimeType || '').toLowerCase();
      const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico|heic)$/i.test(name);
      const isDoc = mime.includes('pdf') || mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('text') || /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)$/i.test(name);
      const isMedia = mime.startsWith('video/') || mime.startsWith('audio/') || /\.(mp4|mp3|mkv|mov|avi|wav|aac|m4a|webm)$/i.test(name);

      if (fileFilter === 'image' || fileFilter === 'images') return isImg;
      if (fileFilter === 'doc' || fileFilter === 'docc' || fileFilter === 'documents') return isDoc;
      if (fileFilter === 'media') return isMedia;
      return true;
    });
  }, [files, searchQuery, fileFilter]);

  // Filter texts by search
  const filteredTexts = useMemo(() => {
    if (!searchQuery) return texts;
    const q = searchQuery.toLowerCase();
    return texts.filter((t) => (t.text || '').toLowerCase().includes(q) || (t.deviceName || '').toLowerCase().includes(q) || (t.customerName || '').toLowerCase().includes(q));
  }, [texts, searchQuery]);

  // Combined timeline items
  const combinedHistory = useMemo(() => {
    const fileItems = files.map((f) => ({
      ...f,
      _type: 'file',
      itemType: 'file',
      _time: new Date(f.savedAt || f.createdAt || f.uploadedAt || 0).getTime(),
    }));
    const textItems = texts.map((t) => ({
      ...t,
      _type: 'text',
      itemType: 'text',
      _time: new Date(t.receivedAt || t.createdAt || 0).getTime(),
    }));
    return [...fileItems, ...textItems].sort((a, b) => b._time - a._time);
  }, [files, texts]);

  // Filtered combined timeline items
  const filteredHistory = useMemo(() => {
    return combinedHistory.filter((item) => {
      const isFile = item._type === 'file' || item.itemType === 'file' || Boolean(item.originalName || item.size);
      const name = (item.originalName || item.originalname || item.name || item.text || '').toLowerCase();
      const devName = (item.deviceName || '').toLowerCase();
      const custName = (item.customerName || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || name.includes(q) || devName.includes(q) || custName.includes(q);

      if (!matchesSearch) return false;
      if (historyFilter === 'all') return true;
      if (historyFilter === 'texts' || historyFilter === 'text') return !isFile;
      if (historyFilter === 'files') return isFile;

      if (isFile) {
        const mime = (item.mimeType || '').toLowerCase();
        const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico|heic)$/i.test(name);
        const isDoc = mime.includes('pdf') || mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('text') || /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)$/i.test(name);
        const isMedia = mime.startsWith('video/') || mime.startsWith('audio/') || /\.(mp4|mp3|mkv|mov|avi|wav|aac|m4a|webm)$/i.test(name);

        if (historyFilter === 'image' || historyFilter === 'images') return isImg;
        if (historyFilter === 'doc' || historyFilter === 'docc' || historyFilter === 'documents') return isDoc;
        if (historyFilter === 'media') return isMedia;
      }
      return true;
    });
  }, [combinedHistory, searchQuery, historyFilter]);

  // Unprinted files count
  const unprintedCount = useMemo(() => {
    return files.filter((f) => !f.printedStatus).length;
  }, [files]);

  const handleDeleteFile = useCallback(async (fileId) => {
    await deleteFile(fileId);
    addToast({
      type: 'info',
      title: '🗑️ File Deleted',
      message: 'File removed from disk and database.',
    });
  }, [deleteFile, addToast]);

  const handleDeleteText = useCallback(async (textId) => {
    await deleteText(textId);
    addToast({
      type: 'info',
      title: '🗑️ Note Deleted',
      message: 'Text note has been deleted.',
    });
  }, [deleteText, addToast]);

  const handleDeleteCustomerFolder = useCallback(async (customerId) => {
    await deleteCustomerFolder(customerId);
    addToast({
      type: 'info',
      title: '🗑️ Folder Deleted',
      message: 'Customer folder has been removed.',
    });
  }, [deleteCustomerFolder, addToast]);

  const showSearch = ['files', 'texts', 'history'].includes(activeNav);

  return (
    <div className="laptop-layout">
      {/* Toast Notifications */}
      <NotificationContainer toasts={toasts} dismiss={dismiss} />

      {/* Sidebar with Mobile Drawer */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          setIsMobileMenuOpen(false);
        }}
        filesCount={files.length}
        unprintedCount={unprintedCount}
        textsCount={texts.length}
        historyCount={combinedHistory.length}
        connected={connected}
        peerState={peerState}
        connectedDevice={connectedDevice}
        sessionId={sessionId}
        shop={shop}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="laptop-main">
        {/* Header Bar */}
        <header className="main-header">
          <div className="header-top-row flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile Hamburger Toggle Button */}
              <button
                className="btn-icon mobile-hamburger-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                title="Open Navigation Menu"
                aria-label="Open menu"
              >
                ☰
              </button>
              <div className="page-heading min-w-0">
                <h2 className="view-title">{PAGE_TITLES[activeNav] || 'Dashboard'}</h2>
              </div>
            </div>

            <div className="header-right-actions flex items-center gap-2 flex-shrink-0">
              {showSearch && (
                <div className="header-search-wrapper desktop-search-only">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>
              )}

              {shop ? (
                <div className="shop-badge flex items-center gap-1">
                  <span className="shop-name">🏪 {shop.shopName}</span>
                  <button className="btn btn-ghost btn-xs logout-btn" onClick={handleLogout}>Logout</button>
                </div>
              ) : (
                <div className="auth-actions flex items-center gap-1">
                  <button className="btn btn-ghost btn-xs header-auth-btn" onClick={() => navigate('/login')}>Login</button>
                  <button className="btn btn-primary btn-xs header-auth-btn" onClick={() => navigate('/register')}>
                    <span>🏪</span> Register
                  </button>
                </div>
              )}
            </div>
          </div>

          {showSearch && (
            <div className="header-mobile-search-row w-full">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
          )}
        </header>

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
                onDeleteFile={handleDeleteFile}
                onDeleteText={handleDeleteText}
                onDeleteFolder={handleDeleteCustomerFolder}
                onTogglePrint={togglePrintStatus}
                sessionId={sessionId}
                shop={shop}
                initialCustomerId={selectedFolderCustomerId}
                onSelectCustomer={setSelectedFolderCustomerId}
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
                          onDelete={handleDeleteFile}
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
              <TextShare
                texts={filteredTexts}
                onDelete={handleDeleteText}
                sessionId={sessionId}
                shopId={shop?.shopId}
              />
            )}

            {/* ── 4. PRINT MANAGEMENT ── */}
            {activeNav === 'print' && (
              <PrintPage
                files={files}
                onTogglePrint={togglePrintStatus}
                onDelete={handleDeleteFile}
                shop={shop}
              />
            )}

            {/* ── 5. BILLING & INVOICING ── */}
            {activeNav === 'billing' && (
              <BillingPage
                files={files}
                texts={texts}
                shop={shop}
                sessionId={sessionId}
              />
            )}

            {/* ── 6. CUSTOMER CRM ── */}
            {activeNav === 'customers' && (
              <CustomersPage
                files={files}
                texts={texts}
                onNavChange={(nav, targetCustId) => {
                  if (targetCustId) {
                    setSelectedFolderCustomerId(targetCustId);
                  }
                  setActiveNav(nav);
                }}
                shop={shop}
              />
            )}

            {/* ── 7. REPORTS & ANALYTICS ── */}
            {activeNav === 'analytics' && (
              <AnalyticsPage
                files={files}
                texts={texts}
                shop={shop}
              />
            )}

            {/* ── 8. QR MANAGEMENT ── */}
            {activeNav === 'qr_management' && (
              <QRManagementPage
                shop={shop}
                sessionId={sessionId}
                files={files}
              />
            )}

            {/* ── 9. FULL HISTORY ── */}
            {activeNav === 'history' && (
              <>
                <CategoryFilter currentFilter={historyFilter} onFilterChange={setHistoryFilter} />
                <TimelineHistory
                  items={filteredHistory}
                  combinedHistory={filteredHistory}
                  onDeleteFile={handleDeleteFile}
                  onDeleteText={handleDeleteText}
                  onTogglePrint={togglePrintStatus}
                />
              </>
            )}

            {/* ── 10. COUNTER STANDEE ── */}
            {activeNav === 'standee' && (
              <div className="standee-wrapper">
                <QRStandee
                  qrDataUrl={qrUrl}
                  shopName={shop ? shop.shopName : 'Direct Print & File Drop'}
                  shopId={shop ? (shop.shopId || shop.id) : sessionId}
                  sessionId={sessionId}
                />
              </div>
            )}

            {/* ── 11. SETTINGS ── */}
            {activeNav === 'settings' && (
              <SettingsPage shop={shop} sessionId={sessionId} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Mobile Bottom Navigation Bar (Screens <768px) ── */}
        <nav className="mobile-bottom-nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Home' },
            { id: 'customer_folders', icon: '📂', label: 'Folders', badge: unprintedCount },
            { id: 'files', icon: '📄', label: 'Files', badge: files.length },
            { id: 'print', icon: '🖨️', label: 'Print', badge: unprintedCount },
            { id: 'billing', icon: '💳', label: 'Billing' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`bottom-nav-item ${activeNav === tab.id ? 'active' : ''}`}
              onClick={() => setActiveNav(tab.id)}
            >
              <div className="bottom-nav-icon-wrap">
                <span className="bottom-nav-icon">{tab.icon}</span>
                {tab.badge > 0 && <span className="bottom-nav-badge">{tab.badge}</span>}
              </div>
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </main>

      <style>{`
        .laptop-layout {
          display: flex;
          height: 100vh;
          width: 100%;
          max-width: 100vw;
          overflow: hidden;
          background: var(--bg-primary);
          position: relative;
        }

        .laptop-sidebar {
          width: 260px;
          min-width: 260px;
          max-width: 260px;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: var(--space-5) var(--space-4);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow-y: auto;
          z-index: 20;
          box-sizing: border-box;
        }

        .laptop-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
          width: 100%;
          max-width: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
          position: relative;
        }

        .main-header {
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: sticky;
          top: 0;
          z-index: 100;
          width: 100%;
          flex-shrink: 0;
          box-sizing: border-box;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
        }

        .header-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: var(--space-2);
        }

        .desktop-search-only {
          display: block;
        }

        .header-mobile-search-row {
          display: none;
          width: 100%;
        }

        .header-mobile-search-row .search-box {
          max-width: 100% !important;
          width: 100% !important;
        }

        .mobile-hamburger-btn {
          display: none;
          font-size: 1.25rem;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          cursor: pointer;
          flex-shrink: 0;
        }

        .view-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-right-actions {
          flex-shrink: 0;
        }

        .shop-badge {
          background: var(--accent-light);
          border: 1px solid var(--border-accent);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .shop-name {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--accent-primary);
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-xs { padding: 3px 8px; font-size: 11px; border-radius: var(--radius-md); }
        .header-auth-btn { padding: 5px 10px; font-size: var(--font-size-xs); font-weight: 600; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 4px; }

        .content-area {
          flex: 1;
          padding: 1.5rem 2rem;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .file-list { display: flex; flex-direction: column; gap: var(--space-3); width: 100%; }
        .standee-wrapper { width: 100%; max-width: 360px; margin: 0 auto; }
        .mt-4 { margin-top: var(--space-4); }

        /* ── Mobile Bottom Navigation Bar (Hidden by default on Desktop) ── */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #FFFFFF;
          border-top: 1px solid var(--border);
          padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
          z-index: 50;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
          justify-content: space-around;
          align-items: center;
        }

        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-family);
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          flex: 1;
        }

        .bottom-nav-item.active {
          color: var(--accent-primary);
        }

        .bottom-nav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bottom-nav-icon {
          font-size: 1.25rem;
        }

        .bottom-nav-badge {
          position: absolute;
          top: -4px;
          right: -8px;
          background: var(--danger);
          color: white;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 999px;
          min-width: 14px;
          text-align: center;
        }

        .bottom-nav-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        /* ── Responsive Tablet Breakpoints (<1024px) ── */
        @media (max-width: 1024px) {
          .laptop-layout {
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
          }

          .laptop-main {
            width: 100%;
            height: 100vh;
            height: 100dvh;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }

          .mobile-hamburger-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .content-area {
            padding: 1.25rem 1.5rem;
          }
        }

        /* ── Responsive Mobile Breakpoints (<768px) ── */
        @media (max-width: 768px) {
          .main-header {
            padding: 8px 12px;
            gap: 8px;
          }

          .desktop-search-only {
            display: none !important;
          }

          .header-mobile-search-row {
            display: block !important;
          }

          .view-title {
            font-size: 0.88rem;
          }

          .shop-name {
            max-width: 95px;
            font-size: 11px;
          }

          .header-auth-btn {
            padding: 4px 8px;
            font-size: 10px;
          }

          .content-area {
            padding: 0.875rem 0.75rem 5.5rem; /* Extra bottom padding for mobile bottom bar */
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow-x: hidden;
          }

          .mobile-bottom-nav {
            display: flex;
          }
        }

        /* ── Responsive Small Screen (<480px) ── */
        @media (max-width: 480px) {
          .shop-badge {
            padding: 4px 8px;
            gap: 4px;
          }

          .shop-name {
            max-width: 80px;
            font-size: 10px;
          }

          .logout-btn {
            padding: 2px 6px;
            font-size: 10px;
          }

          .header-auth-btn span {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
