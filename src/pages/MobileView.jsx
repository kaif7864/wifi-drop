/**
 * client/src/pages/MobileView.jsx
 * Mobile upload page — file picker, camera capture, text send, with WebRTC P2P + Hybrid mode
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useWebRTC } from '../hooks/useWebRTC';
import { ProgressBar } from '../components/ProgressBar';
import { getHardwareFingerprint } from '../utils/fingerprint';
import { stageUploadInQueue, getStagedQueue, clearStagedItem } from '../utils/offlineQueue';
import { config } from '../config';

const DEVICE_NAME_KEY = 'wifidrop_device_name';

function getSavedDeviceName() {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY) || 'Mobile Device';
  } catch {
    return 'Mobile Device';
  }
}

function getShopAndSessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let targetCustId = params.get('customerId') || null;
  
  if (targetCustId) {
    try { sessionStorage.setItem('wifidrop_target_customer_id', targetCustId); } catch {}
  } else {
    try { targetCustId = sessionStorage.getItem('wifidrop_target_customer_id') || null; } catch {}
  }

  return {
    sessionId: params.get('session') || null,
    shopId: params.get('shop') || params.get('session') || 'default',
    targetCustomerId: targetCustId,
  };
}

export function MobileView() {
  const deviceName = getSavedDeviceName();
  const { sessionId, shopId, targetCustomerId } = useMemo(() => getShopAndSessionFromUrl(), []);
  
  const customerFp = useMemo(() => getHardwareFingerprint(), []);
  const effectiveDeviceName = customerFp?.deviceName || deviceName;
  const effectiveCustomerId = targetCustomerId || customerFp?.customerId;
  const { socket, connected } = useSocket('mobile', effectiveDeviceName, sessionId);
  const { uploading, uploadProgress, uploadFiles, sendText } = useTransfer();

  const { peerState, initiateConnect, sendFileP2P } = useWebRTC({
    socket,
    sessionId,
    role: 'mobile',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'success' | 'error'
  const [p2pProgress, setP2pProgress] = useState(0);
  const [isP2pUploading, setIsP2pUploading] = useState(false);
  const [textStatus, setTextStatus] = useState(null);
  const [activeMode, setActiveMode] = useState('file'); // 'file' | 'text'
  const [customerName, setCustomerName] = useState(() => {
    try { return localStorage.getItem('wifidrop_customer_name') || ''; } catch { return ''; }
  });

  const handleNameChange = (e) => {
    const val = e.target.value;
    setCustomerName(val);
    try { localStorage.setItem('wifidrop_customer_name', val); } catch {}
  };

  const galleryInputRef = useRef(null);
  const docInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Trigger WebRTC peer connect attempt when socket connects in a session
  useEffect(() => {
    if (connected && sessionId) {
      initiateConnect();
    }
  }, [connected, sessionId, initiateConnect]);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
        const filtered = newFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
        return [...prev, ...filtered];
      });
    }
    e.target.value = '';
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const clearAllSelectedFiles = () => {
    setSelectedFiles([]);
  };

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // Auto-flush offline queue when internet connection restores
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      getStagedQueue().then(async (queue) => {
        for (const item of queue) {
          try {
            if (item.type === 'text') {
              await sendText(item.text, item.deviceName, item.sessionId, item.shopId, item.customerId, item.customerName);
            }
            await clearStagedItem(item.id);
          } catch {}
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sendText]);

  // Hybrid file upload strategy: try P2P WebRTC DataChannel -> HTTP upload -> Offline IndexedDB Queue
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploadStatus(null);

    // Strategy 1: Attempt WebRTC P2P Transfer if DataChannel is connected
    if (peerState === 'connected') {
      try {
        setIsP2pUploading(true);
        setP2pProgress(0);
        for (const file of selectedFiles) {
          await sendFileP2P(file, effectiveDeviceName, effectiveCustomerId, customerName.trim() || null, (progress) => {
            setP2pProgress(progress);
          });
        }
        setUploadStatus('success');
        setSelectedFiles([]);
        if (galleryInputRef.current) galleryInputRef.current.value = '';
        if (docInputRef.current) docInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        return;
      } catch (err) {
        console.warn('[Hybrid Transfer] WebRTC P2P transfer failed, falling back to HTTP Upload:', err);
      } finally {
        setIsP2pUploading(false);
      }
    }

    // Strategy 2 & 3: HTTP API (Cloud Relay / Local LAN Direct Server)
    try {
      await uploadFiles(selectedFiles, effectiveDeviceName, sessionId, shopId, effectiveCustomerId, customerName.trim() || null);
      setUploadStatus('success');
      setSelectedFiles([]);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    } catch (err) {
      // Strategy 4: Disconnection Offline Queue in IndexedDB
      if (!isOnline) {
        stageUploadInQueue({
          type: 'files',
          fileNames: selectedFiles.map(f => f.name),
          deviceName: effectiveDeviceName,
          sessionId,
          shopId,
          customerId: effectiveCustomerId,
          customerName: customerName.trim() || null,
        });
        setUploadStatus('queued');
      } else {
        setUploadStatus('error');
      }
    }
  };

  const handleTextSend = async () => {
    if (!textInput.trim()) return;
    try {
      setTextStatus(null);
      await sendText(textInput.trim(), effectiveDeviceName, sessionId, shopId, effectiveCustomerId, customerName.trim() || null);
      setTextStatus('success');
      setTextInput('');
    } catch {
      if (!isOnline) {
        stageUploadInQueue({
          type: 'text',
          text: textInput.trim(),
          deviceName: effectiveDeviceName,
          sessionId,
          shopId,
          customerId: customerFp?.customerId,
          customerName: customerName.trim() || null,
        });
        setTextStatus('queued');
        setTextInput('');
      } else {
        setTextStatus('error');
      }
    }
  };

  // Auto-clear status messages
  useEffect(() => {
    if (!uploadStatus) return;
    const t = setTimeout(() => setUploadStatus(null), 3000);
    return () => clearTimeout(t);
  }, [uploadStatus]);

  useEffect(() => {
    if (!textStatus) return;
    const t = setTimeout(() => setTextStatus(null), 3000);
    return () => clearTimeout(t);
  }, [textStatus]);

  const activeProgress = isP2pUploading ? p2pProgress : uploadProgress;
  const isCurrentlyTransferring = uploading || isP2pUploading;

  return (
    <div className="mobile-layout">
      {/* Header */}
      <header className="mobile-header">
        <div className="mobile-logo">
          <span>📡</span>
          <span className="mobile-logo-text">{config.appName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="dot dot-success" />
          <span className="mobile-status-text">
            {peerState === 'connected'
              ? '⚡ P2P Direct'
              : connected
              ? '🟢 Live Relay'
              : '☁️ Cloud Inbox Ready'}
          </span>
        </div>
      </header>

      {/* Sub-header & Optional Name Input */}
      <div className="mobile-sub-header">
        {targetCustomerId && (
          <div
            className="target-folder-banner glass-card p-2 mb-2 flex items-center justify-between text-xs"
            style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', color: '#4F46E5', fontWeight: 600 }}
          >
            <span>🔗 Directing to Folder: <strong>{targetCustomerId}</strong></span>
            <span className="badge badge-accent">Folder QR</span>
          </div>
        )}
        <div className="mobile-name-card glass-card">
          <div className="mobile-name-icon">👤</div>
          <div className="mobile-name-content">
            <div className="flex items-center justify-between">
              <label className="mobile-name-label">YOUR NAME / TOKEN NO.</label>
              <span className="mobile-name-badge">Optional</span>
            </div>
            <input
              type="text"
              className="mobile-name-input"
              placeholder="e.g. Ramesh Kumar"
              value={customerName}
              onChange={handleNameChange}
            />
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="mobile-tabs">
        <button
          className={`mobile-tab ${activeMode === 'file' ? 'mobile-tab-active' : ''}`}
          onClick={() => setActiveMode('file')}
        >
          📁 Files
        </button>
        <button
          className={`mobile-tab ${activeMode === 'text' ? 'mobile-tab-active' : ''}`}
          onClick={() => setActiveMode('text')}
        >
          📝 Text
        </button>
      </div>

      <div className="mobile-content">
        <AnimatePresence mode="wait">

          {/* ── File Mode ── */}
          {activeMode === 'file' && (
            <motion.div
              key="file"
              className="mode-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              {/* Hidden file inputs */}
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                id="gallery-picker"
              />
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt,application/zip"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                id="doc-picker"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                id="camera-picker"
              />

              {/* Pick buttons */}
              <div className="pick-buttons">
                <label htmlFor="gallery-picker" className="pick-card glass-card">
                  <span className="pick-icon">🖼️</span>
                  <span className="pick-label">Photos & Gallery</span>
                  <span className="pick-sub">Phone photos</span>
                </label>
                <label htmlFor="doc-picker" className="pick-card glass-card">
                  <span className="pick-icon">📄</span>
                  <span className="pick-label">PDFs & Docs</span>
                  <span className="pick-sub">Documents</span>
                </label>
                <label htmlFor="camera-picker" className="pick-card glass-card">
                  <span className="pick-icon">📷</span>
                  <span className="pick-label">Camera</span>
                  <span className="pick-sub">Live photo</span>
                </label>
              </div>

              {/* Selected file tray with accumulation & individual delete (X) */}
              {selectedFiles.length > 0 && (
                <div className="selected-files glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="selected-label" style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                      📥 Ready to Send ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})
                    </p>
                    <button className="btn-text-danger" onClick={clearAllSelectedFiles}>
                      Clear All 🗑️
                    </button>
                  </div>
                  {selectedFiles.map((f, i) => (
                    <div
                      key={`${f.name}_${i}`}
                      className="file-item-card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        marginBottom: '8px',
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                          {f.type?.startsWith('image/') ? '🖼️' : f.type?.includes('pdf') ? '📄' : '📁'}
                        </span>
                        <span
                          title={f.name}
                          style={{
                            display: 'block',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#1E293B',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {f.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          className="btn-remove-selected"
                          onClick={() => removeSelectedFile(i)}
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              {isCurrentlyTransferring && (
                <div className="upload-status-card glass-card">
                  <p className="uploading-label">
                    {isP2pUploading ? 'Sending via WebRTC P2P...' : 'Uploading via HTTP...'}
                  </p>
                  <ProgressBar percent={activeProgress} />
                </div>
              )}

              {/* Status messages */}
              <AnimatePresence>
                {uploadStatus === 'success' && (
                  <motion.div
                    className="status-msg status-success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ✅ Files sent to laptop!
                  </motion.div>
                )}
                {uploadStatus === 'error' && (
                  <motion.div
                    className="status-msg status-error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ❌ Upload failed. Try again.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send button */}
              <button
                className="btn btn-primary w-full"
                onClick={handleUpload}
                disabled={isCurrentlyTransferring || selectedFiles.length === 0}
                style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}
              >
                {isCurrentlyTransferring ? 'Sending...' : `Send ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''} →`}
              </button>
            </motion.div>
          )}

          {/* ── Text Mode ── */}
          {activeMode === 'text' && (
            <motion.div
              key="text"
              className="mode-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              <textarea
                className="textarea"
                rows={6}
                placeholder="Type or paste text, links, notes…"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />

              <AnimatePresence>
                {textStatus === 'success' && (
                  <motion.div
                    className="status-msg status-success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ✅ Text sent to laptop!
                  </motion.div>
                )}
                {textStatus === 'error' && (
                  <motion.div
                    className="status-msg status-error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ❌ Send failed. Try again.
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                className="btn btn-primary w-full"
                onClick={handleTextSend}
                disabled={!textInput.trim()}
                style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}
              >
                Send Text →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .mobile-layout {
          min-height: 100vh;
          background: var(--bg-primary);
          display: flex;
          flex-direction: column;
          max-width: 480px;
          width: 100%;
          margin: 0 auto;
          overflow-x: hidden !important;
          box-sizing: border-box;
        }

        .mobile-sub-header {
          padding: var(--space-3) var(--space-4);
          background: var(--bg-primary);
        }

        .mobile-name-card {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          background: #ffffff;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-accent);
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.06);
        }

        .mobile-name-icon {
          font-size: 1.2rem;
          background: var(--accent-light);
          color: var(--accent-primary);
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-name-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mobile-name-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-primary);
          letter-spacing: 0.05em;
        }

        .mobile-name-badge {
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          padding: 1px 6px;
          border-radius: var(--radius-full);
        }

        .mobile-name-input {
          border: none;
          background: transparent;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--text-primary);
          outline: none;
          padding: 0;
          width: 100%;
        }

        .mobile-name-input::placeholder {
          color: var(--text-muted);
          font-weight: 400;
          font-size: var(--font-size-xs);
        }

        .mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .mobile-logo {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-base);
        }

        .mobile-logo-text {
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .mobile-status-text {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }

        .mobile-sub-header {
          padding: var(--space-5) var(--space-6) var(--space-2);
        }

        .mobile-sub-title {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--text-primary);
        }

        .mobile-session-tag {
          font-size: var(--font-size-xs);
          color: var(--accent-secondary);
          margin-top: 2px;
        }

        .mobile-tabs {
          display: flex;
          gap: var(--space-2);
          padding: 0 var(--space-6) var(--space-5);
        }

        .mobile-tab {
          flex: 1;
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-muted);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .mobile-tab-active {
          background: var(--accent-glow) !important;
          border-color: var(--border-accent) !important;
          color: var(--accent-secondary) !important;
        }

        .mobile-content {
          flex: 1;
          padding: 0 var(--space-6) var(--space-8);
          overflow-y: auto;
        }

        .mode-panel {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding-top: var(--space-2);
        }

        .pick-buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .btn-remove-selected {
          background: #FEE2E2;
          color: #EF4444;
          border: 1px solid #FCA5A5;
          border-radius: 9999px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1;
        }

        .btn-remove-selected:hover {
          background: #EF4444;
          color: #ffffff;
        }

        .btn-text-danger {
          background: transparent;
          border: none;
          color: #EF4444;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
        }

        .pick-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-6) var(--space-4);
          gap: var(--space-2);
          cursor: pointer;
          text-align: center;
          transition: all var(--transition-base);
          min-height: 120px;
        }

        .pick-card:hover, .pick-card:active {
          background: var(--bg-glass-hover);
          border-color: var(--border-accent);
          box-shadow: var(--shadow-accent);
          transform: translateY(-2px);
        }

        .pick-icon { font-size: 2rem; }

        .pick-label {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--text-primary);
        }

        .pick-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }

        .selected-files {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .selected-label {
          font-size: var(--font-size-xs);
          color: var(--accent-secondary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .selected-files {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .selected-file-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }

        .selected-file-name {
          display: block !important;
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1;
          min-width: 0 !important;
          width: 100% !important;
          word-break: break-all;
        }

        .selected-file-size {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .upload-status-card {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .uploading-label {
          font-size: var(--font-size-xs);
          color: var(--accent-secondary);
          font-weight: 500;
        }

        .status-msg {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 500;
          text-align: center;
        }

        .status-success {
          background: var(--success-glow);
          color: var(--success);
          border: 1px solid rgba(0,212,170,0.3);
        }

        .status-error {
          background: var(--danger-glow);
          color: var(--danger);
          border: 1px solid rgba(255,92,92,0.3);
        }
      `}</style>
    </div>
  );
}
