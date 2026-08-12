/**
 * client/src/pages/MobileView.jsx
 * Mobile upload page — file picker, camera capture, text send, with WebRTC P2P + Hybrid mode
 */

import { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useWebRTC } from '../hooks/useWebRTC';
import { ProgressBar } from '../components/ProgressBar';
import { getHardwareFingerprint } from '../utils/fingerprint';
import { stageUploadInQueue, getStagedQueue, clearStagedItem } from '../utils/offlineQueue';
import { config } from '../config';

const DocumentScanner = lazy(() =>
  import('../components/DocumentScanner').then((m) => ({ default: m.DocumentScanner }))
);

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

  const rawSession = params.get('session') || null;
  const rawShop = params.get('shop') || null;

  // Determine legitimate shopId vs guest session:
  // If ?shop= is provided, use it.
  // Else if ?session= does NOT start with 'wd_', it is a registered shop's shopId.
  // If ?session= starts with 'wd_', it is a temporary GUEST session -> shopId is 'default'.
  let resolvedShopId = 'default';
  if (rawShop && rawShop !== 'default') {
    resolvedShopId = rawShop;
  } else if (rawSession && !rawSession.startsWith('wd_')) {
    resolvedShopId = rawSession;
  }

  const effectiveSessionId = rawSession || (resolvedShopId !== 'default' ? resolvedShopId : null);

  return {
    sessionId: effectiveSessionId,
    shopId: resolvedShopId,
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
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const [fileNotes, setFileNotes] = useState({});
  const [textInput, setTextInput] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'success' | 'error'
  const [p2pProgress, setP2pProgress] = useState(0);
  const [isP2pUploading, setIsP2pUploading] = useState(false);
  const [textStatus, setTextStatus] = useState(null);
  const [activeMode, setActiveMode] = useState('file'); // 'file' | 'text'
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [customerName, setCustomerName] = useState(() => {
    try { return localStorage.getItem('wifidrop_customer_name') || ''; } catch { return ''; }
  });

  const handleNameChange = (e) => {
    const val = e.target.value;
    setCustomerName(val);
    try { localStorage.setItem('wifidrop_customer_name', val); } catch {}
  };

  const handleFileNoteChange = (index, value) => {
    setFileNotes((prev) => ({ ...prev, [index]: value }));
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
    setFileNotes((prev) => {
      const next = { ...prev };
      delete next[indexToRemove];
      return next;
    });
  };

  const clearAllSelectedFiles = () => {
    setSelectedFiles([]);
    setFileNotes({});
  };

  const handleScanComplete = (file) => {
    if (!file) return;
    setSelectedFiles((prev) => [...prev, file]);
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
            } else if (item.type === 'file' && item.file) {
              await uploadFiles(
                [item.file],
                item.deviceName,
                item.sessionId,
                item.shopId,
                item.customerId,
                item.customerName,
                null,
                { '0': item.note || '' }
              );
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
  }, [sendText, uploadFiles]);

  // Reliable persistent upload directly to server storage and socket delivery
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploadStatus(null);
    setUploadErrorMsg('');

    // 1. WebRTC Direct P2P Transfer (if peer is connected)
    if (peerState === 'connected' && sendFileP2P) {
      try {
        setIsP2pUploading(true);
        for (const file of selectedFiles) {
          await sendFileP2P(file, effectiveDeviceName, effectiveCustomerId, customerName.trim() || null, (pct) => setP2pProgress(pct));
        }
        setUploadStatus('success');
        setSelectedFiles([]);
        setFileNotes({});
        setIsP2pUploading(false);
        return;
      } catch (p2pErr) {
        console.warn('[P2P Upload fallback to HTTP]:', p2pErr);
        setIsP2pUploading(false);
      }
    }

    // 2. Cloud Inbox & HTTP Upload
    try {
      await uploadFiles(
        selectedFiles,
        effectiveDeviceName,
        sessionId,
        shopId,
        effectiveCustomerId,
        customerName.trim() || null,
        customerFp?.customerId,
        fileNotes
      );
      setUploadStatus('success');
      setSelectedFiles([]);
      setFileNotes({});
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || 'Unknown error';
      const errStatus = err?.response?.status;
      console.error('[Upload Error]:', errStatus, errMsg, err);

      // 3. Offline Staging: ONLY queue when device is truly offline
      if (!navigator.onLine) {
        try {
          for (let i = 0; i < selectedFiles.length; i++) {
            const f = selectedFiles[i];
            await stageUploadInQueue({
              type: 'file',
              file: f,
              fileName: f.name,
              fileSize: f.size,
              fileType: f.type,
              note: fileNotes[i] || '',
              deviceName: effectiveDeviceName,
              sessionId,
              shopId,
              customerId: effectiveCustomerId,
              customerName: customerName.trim() || null,
            });
          }
          setUploadStatus('queued');
          setSelectedFiles([]);
          setFileNotes({});
          return;
        } catch (queueErr) {
          console.warn('[Offline Queue Staging Error]:', queueErr);
        }
      }
      setUploadErrorMsg(`${errStatus ? errStatus + ': ' : ''}${errMsg}`);
      setUploadStatus('error');
    }
  };


  const handleTextSend = async () => {
    if (!textInput.trim()) return;
    try {
      setTextStatus(null);
      await sendText(textInput.trim(), effectiveDeviceName, sessionId, shopId, effectiveCustomerId, customerName.trim() || null, customerFp?.customerId);
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
          <span className={`dot ${connected || peerState === 'connected' ? 'dot-success' : 'dot-warning'}`} />
          <span className="mobile-status-text">
            {peerState === 'connected'
              ? 'P2P Direct'
              : connected
              ? 'Live Relay'
              : 'Cloud Inbox Ready'}
          </span>
        </div>
      </header>

      {/* Sub-header & Optional Name Input */}
      <div className="mobile-sub-header">
        {targetCustomerId && (
          <div className="target-folder-banner">
            <div className="target-folder-top flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="target-folder-icon">📂</span>
                <div className="min-w-0">
                  <div className="target-folder-title">Direct Folder Upload</div>
                  <div className="target-folder-subtitle">Target customer folder is linked</div>
                </div>
              </div>
              <span className="target-folder-badge">Folder QR</span>
            </div>
            <div className="target-folder-id-tag">
              <span className="id-label">Target ID:</span>
              <code className="id-code">{targetCustomerId}</code>
            </div>
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
                accept=".pdf,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                <label htmlFor="gallery-picker" className="pick-card pick-card-gallery">
                  <div className="pick-icon-box">
                    <span className="pick-icon">🖼️</span>
                  </div>
                  <span className="pick-label">Photos & Gallery</span>
                  <span className="pick-sub">Phone photos</span>
                </label>
                <label htmlFor="doc-picker" className="pick-card pick-card-docs">
                  <div className="pick-icon-box">
                    <span className="pick-icon">📄</span>
                  </div>
                  <span className="pick-label">PDFs & Docs</span>
                  <span className="pick-sub">Documents</span>
                </label>
                <label htmlFor="camera-picker" className="pick-card pick-card-camera">
                  <div className="pick-icon-box">
                    <span className="pick-icon">📷</span>
                  </div>
                  <span className="pick-label">Camera</span>
                  <span className="pick-sub">Live photo</span>
                </label>
                <button
                  type="button"
                  className="pick-card pick-card-scan"
                  onClick={() => setIsScannerOpen(true)}
                >
                  <div className="pick-icon-box pick-icon-box-scan">
                    <span className="pick-icon">✨</span>
                  </div>
                  <span className="pick-label">Scan Document</span>
                  <span className="pick-sub">Capture & enhance documents</span>
                </button>
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
                  {selectedFiles.map((f, i) => {
                    const isPdfFile = f.type?.includes('pdf') || f.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={`${f.name}_${i}`}
                        className="file-item-card-wrap"
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '14px',
                          padding: '10px 12px',
                          marginBottom: '8px',
                          width: '100%',
                          boxSizing: 'border-box',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                              {f.type?.startsWith('image/') ? '🖼️' : isPdfFile ? '📄' : '📁'}
                            </span>
                            <span
                              title={f.name}
                              style={{
                                display: 'block',
                                fontSize: '0.82rem',
                                fontWeight: 700,
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

                        {/* File Password / Note Input */}
                        <div className="file-note-input-row">
                          <span className="file-note-icon">🔑</span>
                          <input
                            type="text"
                            className="file-note-input"
                            placeholder={
                              isPdfFile
                                ? 'PDF password or instructions (e.g. Aadhaar DOB)...'
                                : 'Print note (e.g. Color 2 copies, Photo paper)...'
                            }
                            value={fileNotes[i] || ''}
                            onChange={(e) => handleFileNoteChange(i, e.target.value)}
                            maxLength={70}
                          />
                        </div>
                      </div>
                    );
                  })}
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
                {uploadStatus === 'queued' && (
                  <motion.div
                    className="status-msg"
                    style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ☁️ Saved in Offline Queue! Will auto-send when connection restores.
                  </motion.div>
                )}
                {uploadStatus === 'error' && (
                  <motion.div
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 14px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ❌ Upload failed{uploadErrorMsg ? `: ${uploadErrorMsg}` : '. Try again.'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send button */}
              <button
                className={`btn-send-main w-full ${selectedFiles.length > 0 ? 'active' : ''}`}
                onClick={handleUpload}
                disabled={isCurrentlyTransferring}
                style={{ marginTop: 'var(--space-4)' }}
              >
                {isCurrentlyTransferring ? (
                  '🚀 Sending...'
                ) : selectedFiles.length > 0 ? (
                  `🚀 Send ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                ) : (
                  '🚀 Select files to send'
                )}
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
          padding: 10px 16px;
          background: var(--bg-primary);
        }

        .target-folder-banner {
          background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
          border: 1px solid #C7D2FE;
          border-radius: 14px;
          padding: 10px 12px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.06);
        }

        .target-folder-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
        }

        .target-folder-icon {
          font-size: 1.2rem;
          background: #FFFFFF;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          flex-shrink: 0;
        }

        .target-folder-title {
          font-size: 12px;
          font-weight: 800;
          color: #3730A3;
          line-height: 1.2;
        }

        .target-folder-subtitle {
          font-size: 10px;
          color: #6366F1;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .target-folder-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          background: #4F46E5;
          color: #FFFFFF;
          letter-spacing: 0.02em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .target-folder-id-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.75);
          padding: 4px 8px;
          border-radius: 8px;
          border: 1px solid rgba(199, 210, 254, 0.7);
        }

        .id-label {
          font-size: 10px;
          font-weight: 700;
          color: #4B5563;
        }

        .id-code {
          font-size: 11px;
          font-weight: 800;
          color: #4338CA;
          font-family: monospace;
          word-break: break-all;
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

        .file-note-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 5px 8px;
          transition: all 0.2s ease;
        }

        .file-note-input-row:focus-within {
          border-color: #6366F1;
          background: #EEF2FF;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .file-note-icon {
          font-size: 11px;
          opacity: 0.75;
          flex-shrink: 0;
        }

        .file-note-input {
          border: none;
          background: transparent;
          font-size: 11px;
          font-weight: 600;
          color: #1E293B;
          width: 100%;
          outline: none;
          padding: 0;
        }

        .file-note-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
          font-size: 10.5px;
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
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .pick-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 14px 16px;
          gap: 8px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
          border-radius: 20px;
          width: 100%;
          font-family: inherit;
          box-sizing: border-box;
          text-decoration: none;
          position: relative;
        }

        .pick-card:hover, .pick-card:active {
          transform: translateY(-2px);
        }

        .pick-card-gallery {
          background: linear-gradient(145deg, #E6F7FF 0%, #F0F9FF 100%);
          border: 1.5px solid #BAE6FD;
          box-shadow: 0 4px 14px rgba(186, 230, 253, 0.25);
        }
        .pick-card-gallery:hover {
          border-color: #38BDF8;
          box-shadow: 0 6px 18px rgba(56, 189, 248, 0.3);
        }

        .pick-card-docs {
          background: linear-gradient(145deg, #F5F3FF 0%, #FAF5FF 100%);
          border: 1.5px solid #DDD6FE;
          box-shadow: 0 4px 14px rgba(221, 214, 254, 0.25);
        }
        .pick-card-docs:hover {
          border-color: #A78BFA;
          box-shadow: 0 6px 18px rgba(167, 139, 250, 0.3);
        }

        .pick-card-camera {
          background: linear-gradient(145deg, #FEFCE8 0%, #FFFBEB 100%);
          border: 1.5px solid #FDE68A;
          box-shadow: 0 4px 14px rgba(253, 230, 138, 0.25);
        }
        .pick-card-camera:hover {
          border-color: #FBBF24;
          box-shadow: 0 6px 18px rgba(251, 191, 36, 0.3);
        }

        .pick-card-scan {
          background: linear-gradient(145deg, #F3E8FF 0%, #E0F2FE 100%);
          border: 1.5px solid #C084FC;
          box-shadow: 0 4px 18px rgba(192, 132, 252, 0.28);
        }
        .pick-card-scan:hover, .pick-card-scan:active {
          border-color: #9333EA;
          box-shadow: 0 6px 22px rgba(147, 51, 234, 0.35);
        }

        .pick-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
          margin-bottom: 2px;
          transition: transform 0.2s ease;
        }

        .pick-card:hover .pick-icon-box {
          transform: scale(1.06);
        }

        .pick-icon-box-scan {
          background: linear-gradient(135deg, #818CF8 0%, #06B6D4 100%);
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }

        .pick-icon {
          font-size: 1.6rem;
          line-height: 1;
        }

        .pick-label {
          font-size: 0.92rem;
          font-weight: 700;
          color: #0F172A;
        }

        .pick-card-scan .pick-label {
          color: #7C3AED;
        }

        .pick-sub {
          font-size: 0.76rem;
          color: #64748B;
          font-weight: 500;
        }

        .pick-card-scan .pick-sub {
          color: #0D9488;
          font-weight: 600;
        }

        .btn-send-main {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: none;
          background: #C7D2FE;
          color: #FFFFFF;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(199, 210, 254, 0.4);
        }

        .btn-send-main.active {
          background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
          color: #FFFFFF;
          box-shadow: 0 4px 16px rgba(79, 70, 229, 0.35);
        }

        .btn-send-main.active:hover {
          background: linear-gradient(135deg, #4338CA 0%, #4F46E5 100%);
          transform: translateY(-1px);
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

      {isScannerOpen && (
        <Suspense fallback={null}>
          <DocumentScanner
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanComplete={handleScanComplete}
          />
        </Suspense>
      )}
    </div>
  );
}
