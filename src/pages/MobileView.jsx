/**
 * client/src/pages/MobileView.jsx
 * Mobile upload page — file picker, camera capture, text send, with WebRTC P2P + Hybrid mode
 */

import { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useSocket } from '../hooks/useSocket';
import { useTransfer } from '../hooks/useTransfer';
import { useWebRTC } from '../hooks/useWebRTC';
import { ProgressBar } from '../components/ProgressBar';
import { getHardwareFingerprint } from '../utils/fingerprint';
import { stageUploadInQueue, getStagedQueue, clearStagedItem } from '../utils/offlineQueue';
import { config } from '../config';
import { PdfCanvasViewer } from '../components/PdfCanvasViewer';
import { sendSystemNotification, requestNotificationPermission } from '../utils/notification';

const DocumentScanner = lazy(() =>
  import('../components/DocumentScanner').then((m) => ({ default: m.DocumentScanner }))
);

const DEVICE_NAME_KEY = 'wifidrop_device_name';

function formatSelectedFileSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Detach File from input so mobile browsers don't revoke it when input is reset */
function persistPickedFile(file) {
  if (!file) return null;
  try {
    const type = file.type
      || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    const blob = file.slice(0, file.size, type);
    return new File([blob], file.name, { type, lastModified: file.lastModified || Date.now() });
  } catch {
    return file;
  }
}
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

  let rawSession = params.get('session') || null;
  let rawShop = params.get('shop') || null;

  // Fallback to session storage if address bar was already masked
  if (!rawSession) {
    try { rawSession = sessionStorage.getItem('wifidrop_session_id') || null; } catch {}
  }
  if (!rawShop) {
    try { rawShop = sessionStorage.getItem('wifidrop_shop_id') || null; } catch {}
  }

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
  const effectiveCustomerId = targetCustomerId || customerFp?.customerId || 'cust_anonymous';
  const isViewOnlyParam = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('view') === 'only' || p.get('mode') === 'view';
  }, []);

  // Mask/Clean sensitive URL query parameters (session, customerId, shop) from browser address bar
  useEffect(() => {
    if (window.location.search) {
      try {
        if (sessionId) sessionStorage.setItem('wifidrop_session_id', sessionId);
        if (shopId && shopId !== 'default') sessionStorage.setItem('wifidrop_shop_id', shopId);
      } catch {}

      const cleanPath = window.location.pathname + (isViewOnlyParam ? '#view' : '');
      window.history.replaceState({ masked: true }, document.title, cleanPath);
    }
  }, [sessionId, shopId, isViewOnlyParam]);

  const { socket, connected } = useSocket('mobile', effectiveDeviceName, sessionId);
  const { files, texts, uploading, uploadProgress, uploadFiles, sendText, fetchHistory } = useTransfer(shopId);

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
  const [textStatus, setTextStatus] = useState(null); // null | 'success' | 'error'
  const [previewModal, setPreviewModal] = useState(null); // { url, name, isPdf, isImg }
  const isTempQrSession = Boolean(sessionId && sessionId.startsWith('temp_'));
  const isViewPortalSession = Boolean(isViewOnlyParam);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [activeMode, setActiveMode] = useState(() => (isViewPortalSession ? 'view' : 'file')); // 'file' | 'text' | 'view'
  const [customerName, setCustomerName] = useState(() => {
    try { return localStorage.getItem('wifidrop_customer_name') || ''; } catch { return ''; }
  });

  const sessionUploadsKey = useMemo(
    () => `wifidrop_session_uploads_${(sessionId || shopId || 'default').toLowerCase()}`,
    [sessionId, shopId]
  );

  const [recentUploads, setRecentUploads] = useState(() => {
    try {
      const key = `wifidrop_session_uploads_${(sessionId || shopId || 'default').toLowerCase()}`;
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Keep sessionStorage in sync with recent session uploads
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionUploadsKey, JSON.stringify(recentUploads));
    } catch {}
  }, [recentUploads, sessionUploadsKey]);

  const [sessionExpired, setSessionExpired] = useState(false);

  // Socket listener for live print status updates in recent session uploads
  useEffect(() => {
    if (!socket) return;
    const handlePrintUpdate = (data) => {
      const targetId = data.fileId || data.id || data.uuid;
      const status = typeof data.printedStatus === 'boolean' ? data.printedStatus : true;
      if (targetId) {
        setRecentUploads((prev) =>
          prev.map((f) =>
            ((f.uuid === targetId || f.id === targetId || f._id === targetId || f.fileId === targetId)
              ? { ...f, printedStatus: status }
              : f)
          )
        );
      }
      fetchHistory(shopId, sessionId, null, effectiveCustomerId).catch(() => {});
      sendSystemNotification('🖨️ Document Printed!', {
        body: 'Your document was printed successfully by the counter.',
        tag: 'print_' + Date.now(),
      });
    };

    const handleRevokeUpdate = (data) => {
      if (data.session === sessionId || data.shopId === shopId) {
        setSessionExpired(true);
        sendSystemNotification('⏱️ Session Expired', {
          body: 'Your view access session has ended.',
          tag: 'revoke_' + Date.now(),
        });
      }
    };

    socket.on('file_printed', handlePrintUpdate);
    socket.on('print_status_updated', handlePrintUpdate);
    socket.on('session_revoked', handleRevokeUpdate);
    socket.on('temp_qr_revoked', handleRevokeUpdate);

    return () => {
      socket.off('file_printed', handlePrintUpdate);
      socket.off('print_status_updated', handlePrintUpdate);
      socket.off('session_revoked', handleRevokeUpdate);
      socket.off('temp_qr_revoked', handleRevokeUpdate);
    };
  }, [socket, sessionId, shopId, effectiveCustomerId, fetchHistory]);

  // Fetch session history for customer view ONLY if in valid time-limited view session
  useEffect(() => {
    if (isViewPortalSession) {
      fetchHistory(shopId, sessionId, null, effectiveCustomerId)
        .catch((err) => {
          if (err.response?.status === 403 || err.response?.data?.expired) {
            setSessionExpired(true);
          }
        });
      const interval = setInterval(() => {
        fetchHistory(shopId, sessionId, null, effectiveCustomerId)
          .catch((err) => {
            if (err.response?.status === 403 || err.response?.data?.expired) {
              setSessionExpired(true);
            }
          });
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [shopId, sessionId, effectiveCustomerId, fetchHistory, isViewPortalSession]);

  // Check temp QR session status / expiration on mount
  useEffect(() => {
    if (isTempQrSession && sessionId) {
      axios.get(`${config.serverUrl}/api/files?session=${sessionId}`)
        .then((res) => {
          if (res.data?.expired) {
            setSessionExpired(true);
          }
        })
        .catch((err) => {
          if (err.response?.status === 403 || err.response?.status === 404 || err.response?.data?.expired) {
            setSessionExpired(true);
          }
        });
    }
  }, [isTempQrSession, sessionId]);

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
    const input = e.target;
    const rawFiles = Array.from(input.files || []);
    if (rawFiles.length === 0) return;

    const newFiles = rawFiles.map(persistPickedFile).filter(Boolean);
    if (newFiles.length === 0) {
      setUploadErrorMsg('Could not read selected file. Please try again.');
      return;
    }

    setUploadErrorMsg('');
    const existingKeys = new Set(selectedFiles.map((f) => `${f.name}_${f.size}`));
    const filtered = newFiles.filter((f) => f.size > 0 && !existingKeys.has(`${f.name}_${f.size}`));

    if (filtered.length === 0) {
      setUploadErrorMsg(newFiles.some((f) => f.size <= 0)
        ? 'Could not read file size. Try selecting from Downloads or Files app.'
        : 'This file is already in the queue.');
      return;
    }

    setSelectedFiles((prev) => [...prev, ...filtered]);

    // Do NOT clear input.value here — mobile browsers revoke File refs (especially 5MB+ PDFs)
  };

  const openDocPicker = () => {
    setUploadErrorMsg('');
    const input = docInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };

  const openGalleryPicker = () => {
    setUploadErrorMsg('');
    const input = galleryInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };

  const openCameraPicker = () => {
    setUploadErrorMsg('');
    const input = cameraInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
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
      const uploadRes = await uploadFiles(
        selectedFiles,
        effectiveDeviceName,
        sessionId,
        shopId,
        effectiveCustomerId,
        customerName.trim() || null,
        customerFp?.customerId,
        fileNotes
      );
      if (uploadRes?.files && Array.isArray(uploadRes.files)) {
        setRecentUploads((prev) => [...uploadRes.files, ...prev]);
      }
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

  // ── Compute strictly filtered files for this customer/session ──────────────
  const customerFiles = useMemo(() => {
    if (sessionExpired) return [];

    // Case A: Temp QR Session (temp_xxx) or Specific Customer View Link (targetCustomerId)
    if (isTempQrSession || (isViewOnlyParam && targetCustomerId)) {
      const targetId = (targetCustomerId || '').toLowerCase().trim();
      const targetName = (customerName || '').toLowerCase().trim();

      return (files || []).filter((f) => {
        if (!f) return false;
        if (isTempQrSession && f.sessionId === sessionId) return true;
        if (targetId && (f.customerId?.toLowerCase() === targetId || f.targetCustomerId?.toLowerCase() === targetId)) return true;
        if (targetName && f.customerName?.toLowerCase()?.trim() === targetName) return true;
        if (recentUploads.some((rf) => (rf.uuid || rf.id || rf._id) === (f.uuid || f.id || f._id))) return true;
        return false;
      });
    }

    // Case B: Normal View-Only Portal (Counter QR without customer folder)
    if (isViewOnlyParam) {
      const currentCustId = (effectiveCustomerId || '').toLowerCase().trim();
      const currentName = (customerName || '').toLowerCase().trim();
      const recentIds = new Set(recentUploads.map((rf) => rf.uuid || rf.id || rf._id).filter(Boolean));

      // If recentUploads has items in this session, show them
      if (recentIds.size > 0) {
        return (files || []).filter((f) => {
          const fId = f.uuid || f.id || f._id;
          return recentIds.has(fId);
        });
      }

      // If customer has a token/name entered, match ONLY their files
      if (currentName || (currentCustId && currentCustId !== 'cust_anonymous')) {
        return (files || []).filter((f) => {
          if (!f) return false;
          if (currentName && f.customerName?.toLowerCase()?.trim() === currentName) return true;
          if (currentCustId && currentCustId !== 'cust_anonymous' && f.customerId?.toLowerCase() === currentCustId) return true;
          return false;
        });
      }

      // Fresh scan -> 0 files (never leak other shop files!)
      return [];
    }

    // Case C: Normal Upload Mode -> Recent uploads from this session
    return recentUploads;
  }, [files, recentUploads, isTempQrSession, isViewOnlyParam, targetCustomerId, customerName, effectiveCustomerId, sessionId, sessionExpired]);

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

      {/* Mode tabs: Hidden in View-Only mode */}
      {!isViewPortalSession && (
        <div className="mobile-tabs">
          <button
            className={`mobile-tab ${activeMode === 'file' ? 'mobile-tab-active' : ''}`}
            onClick={() => setActiveMode('file')}
          >
            📁 Upload Files
          </button>
          <button
            className={`mobile-tab ${activeMode === 'text' ? 'mobile-tab-active' : ''}`}
            onClick={() => setActiveMode('text')}
          >
            📝 Send Text
          </button>
        </div>
      )}

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
              {sessionExpired ? (
                <div className="empty-state glass-card" style={{ border: '2px solid #FEE2E2', background: '#FEF2F2', padding: '2rem 1.5rem', textAlign: 'center', borderRadius: '18px', margin: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⏱️</div>
                  <h4 style={{ color: '#B91C1C', fontSize: '1.1rem', fontWeight: 800 }}>Upload Session Expired</h4>
                  <p style={{ color: '#7F1D1D', fontSize: '0.84rem', marginTop: '6px', lineHeight: 1.5 }}>
                    This temporary upload QR code has expired or was revoked. Please ask the shopkeeper to generate a new QR code.
                  </p>
                </div>
              ) : (
                <>
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
                    accept=".pdf,application/pdf,application/x-pdf,application/octet-stream,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    onInput={handleFileChange}
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
                    <button type="button" className="pick-card pick-card-gallery" onClick={openGalleryPicker}>
                      <div className="pick-icon-box">
                        <span className="pick-icon">🖼️</span>
                      </div>
                      <span className="pick-label">Photos & Gallery</span>
                      <span className="pick-sub">Phone photos</span>
                    </button>
                    <button type="button" className="pick-card pick-card-docs" onClick={openDocPicker}>
                      <div className="pick-icon-box">
                        <span className="pick-icon">📄</span>
                      </div>
                      <span className="pick-label">PDFs & Docs</span>
                      <span className="pick-sub">Documents</span>
                    </button>
                    <button type="button" className="pick-card pick-card-camera" onClick={openCameraPicker}>
                      <div className="pick-icon-box">
                        <span className="pick-icon">📷</span>
                      </div>
                      <span className="pick-label">Camera</span>
                      <span className="pick-sub">Live photo</span>
                    </button>
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
                </>
              )}

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
                              {formatSelectedFileSize(f.size)}
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

              {/* 📦 Recent Uploads in this session on Permanent QR */}
              {recentUploads.length > 0 && (
                <div className="recent-uploads-section mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
                      📦 Your Uploads (This Session)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                      Live Status
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {recentUploads.map((f, i) => {
                      const fId = f.uuid || f.id || f._id;
                      const previewUrl = f.cloudinarySecureUrl || f.previewUrl || (fId ? `${config.serverUrl}/api/files/${fId}/preview` : null);
                      const isImg = f.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.originalName || '');
                      const isPdf = f.mimeType?.includes('pdf') || (f.originalName || '').toLowerCase().endsWith('.pdf');

                      return (
                        <div key={fId || i} className="recent-file-card glass-card" style={{ padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span>{isImg ? '🖼️' : isPdf ? '📕' : '📄'}</span>
                              <div className="min-w-0">
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                  {f.originalName}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                  {f.size ? `${Math.round(f.size / 1024)} KB` : ''}
                                </div>
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: f.printedStatus ? '#ECFDF5' : '#FFFBEB',
                              color: f.printedStatus ? '#059669' : '#D97706',
                              border: `1px solid ${f.printedStatus ? '#A7F3D0' : '#FDE68A'}`,
                            }}>
                              {f.printedStatus ? '✓ Printed' : '⏳ In Queue'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

          {/* ── View Only Mode (Strictly Read-Only, No Uploads) ── */}
          {(isViewPortalSession || activeMode === 'view') && (
            <motion.div
              key="view"
              className="mode-panel view-portal-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              {/* Premium Hero Status Header */}
              <div className="view-portal-hero glass-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="view-hero-icon">👁️</div>
                    <div>
                      <h3 className="view-hero-title">Customer View Portal</h3>
                      <p className="view-hero-subtitle">
                        {shopId && shopId !== 'default' ? `Shop: ${shopId}` : 'Read-Only Document Access'}
                      </p>
                    </div>
                  </div>
                  <div className="live-status-chip">
                    <span className="live-dot"></span>
                    <span>Live Synced</span>
                  </div>
                </div>

                {/* Live Stats Summary Row */}
                <div className="view-stats-row flex items-center justify-between mt-3 pt-3">
                  <div className="view-stat-box">
                    <span className="stat-num">{customerFiles.length}</span>
                    <span className="stat-label">Files</span>
                  </div>
                  <div className="view-stat-divider"></div>
                  <div className="view-stat-box">
                    <span className="stat-num printed-color">{customerFiles.filter(f => f.printedStatus).length}</span>
                    <span className="stat-label">Printed ✓</span>
                  </div>
                  <div className="view-stat-divider"></div>
                  <div className="view-stat-box">
                    <span className="stat-num queue-color">{customerFiles.filter(f => !f.printedStatus).length}</span>
                    <span className="stat-label">In Queue ⏳</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid rgba(226, 232, 240, 0.6)' }}>
                  <span className="customer-tag-pill">
                    👤 {customerName || effectiveDeviceName}
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7C3AED', background: '#F3E8FF', padding: '3px 8px', borderRadius: '6px' }}>
                    🔒 View-Only Mode
                  </span>
                </div>
              </div>

              {/* If Session is Expired */}
              {sessionExpired ? (
                <div className="empty-state glass-card" style={{ border: '2px solid #FEE2E2', background: '#FEF2F2' }}>
                  <div className="empty-state-icon-wrap">⏱️</div>
                  <h4 className="empty-state-title" style={{ color: '#B91C1C' }}>Access Link Expired</h4>
                  <p className="empty-state-text" style={{ color: '#7F1D1D' }}>
                    This time-limited Customer View Link has expired for your privacy and security. Please ask the shopkeeper to generate a new QR code or link.
                  </p>
                </div>
              ) : customerFiles.length === 0 && texts.length === 0 ? (
                <div className="empty-state glass-card">
                  <div className="empty-state-icon-wrap">📂</div>
                  <h4 className="empty-state-title">No files transferred yet</h4>
                  <p className="empty-state-text">
                    No files found in your designated folder for this session.
                  </p>
                </div>
              ) : (
                <div className="view-only-list flex flex-col gap-3">
                  {/* Files List */}
                  {customerFiles.map((f, i) => {
                    const fId = f.uuid || f.id || f._id;
                    const previewUrl = f.cloudinarySecureUrl || f.previewUrl || (fId ? `${config.serverUrl}/api/files/${fId}/preview` : null);
                    const downloadUrl = f.downloadUrl ? `${config.serverUrl}${f.downloadUrl}` : (fId ? `${config.serverUrl}/api/files/${fId}/download` : null);
                    const isImg = f.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.originalName || '');
                    const isPdf = f.mimeType?.includes('pdf') || (f.originalName || '').toLowerCase().endsWith('.pdf');

                    return (
                      <div key={fId || i} className={`view-file-card ${f.printedStatus ? 'is-printed' : 'is-queued'}`}>
                        {/* Card Top: Icon + Info + Status Pill */}
                        <div className="view-file-header">
                          <div className="view-file-left">
                            <div className="file-type-avatar" style={{
                              background: isImg ? '#EFF6FF' : isPdf ? '#FEF2F2' : '#F1F5F9',
                              color: isImg ? '#2563EB' : isPdf ? '#DC2626' : '#475569'
                            }}>
                              {isImg ? '🖼️' : isPdf ? '📕' : '📄'}
                            </div>
                            <div className="view-file-info">
                              <div className="view-file-name" title={f.originalName}>
                                {f.originalName}
                              </div>
                              <div className="view-file-meta">
                                <span>{f.size ? (f.size / (1024 * 1024) >= 1 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`) : ''}</span>
                                {f.pageCount && f.pageCount > 1 && (
                                  <span className="view-pages-tag"> · 📄 {f.pageCount} Pages</span>
                                )}
                                {f.copies && f.copies > 1 && <span> · {f.copies} Copies</span>}
                              </div>
                            </div>
                          </div>

                          {/* Top Right Status Badge */}
                          <span className={`print-status-tag ${f.printedStatus ? 'printed' : 'queue'}`}>
                            {f.printedStatus ? '✓ Printed' : '⏳ In Queue'}
                          </span>
                        </div>

                        {/* Optional Customer Note / Password */}
                        {f.note && (
                          <div className="view-file-note">
                            🔑 Note: {f.note}
                          </div>
                        )}

                        {/* Card Bottom: Action Buttons */}
                        <div className="view-file-actions-row">
                          {previewUrl && (
                            <button
                              type="button"
                              className="view-card-btn btn-view"
                              onClick={() => setPreviewModal({ url: previewUrl, name: f.originalName, isPdf, isImg, fileSize: f.size })}
                            >
                              👁️ View Preview
                            </button>
                          )}
                          {downloadUrl && (
                            <a href={downloadUrl} download={f.originalName} className="view-card-btn btn-download">
                              ⬇️ Download File
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Texts List */}
                  {texts.map((t, i) => (
                    <div key={t.uuid || t.id || i} className="view-text-card glass-card">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: '1rem' }}>💬</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Customer Note</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#1E293B', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {t.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PDF / Image Preview Modal ── */}
      {previewModal && (
        <div className="mobile-preview-overlay" onClick={() => setPreviewModal(null)}>
          <div className="mobile-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-preview-header">
              <span className="mobile-preview-name" title={previewModal.name}>
                {previewModal.isPdf ? '📕' : previewModal.isImg ? '🖼️' : '📄'} {previewModal.name}
              </span>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <a
                  href={previewModal.url}
                  download={previewModal.name}
                  className="preview-action-btn"
                  style={{ background: '#EEF2FF', color: '#4338CA' }}
                >
                  ⬇️
                </a>
                <button
                  type="button"
                  className="preview-action-btn"
                  style={{ background: '#FEF2F2', color: '#991B1B' }}
                  onClick={() => setPreviewModal(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mobile-preview-body">
              {previewModal.isImg ? (
                <img
                  src={previewModal.url}
                  alt={previewModal.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : previewModal.isPdf ? (
                <PdfCanvasViewer url={previewModal.url} name={previewModal.name} fileSize={previewModal.fileSize || 0} />
              ) : (
                <div style={{ textAlign: 'center', color: '#64748B', padding: '2rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                  <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Preview not available</p>
                  <p style={{ fontSize: '0.8rem' }}>Please download the file to view it.</p>
                  <a
                    href={previewModal.url}
                    download={previewModal.name}
                    className="view-card-btn btn-download"
                    style={{ marginTop: '1rem', display: 'inline-flex' }}
                  >
                    ⬇️ Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          appearance: none;
          -webkit-appearance: none;
        }

        button.pick-card {
          border: none;
          background: none;
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

        /* ── Customer View Portal CSS ── */
        .view-portal-hero {
          background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%);
          border: 1px solid #DBEAFE;
          border-radius: 20px;
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.06);
        }

        .view-hero-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #DBEAFE;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          flex-shrink: 0;
        }

        .view-hero-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
        }

        .view-hero-subtitle {
          font-size: 0.72rem;
          color: #64748B;
          margin: 2px 0 0 0;
        }

        .live-status-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10B981;
          animation: pulseDot 1.5s infinite;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .view-stats-row {
          display: flex;
          align-items: center;
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
        }

        .view-stat-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-num {
          font-size: 1.1rem;
          font-weight: 900;
          color: #0F172A;
        }

        .stat-num.printed-color { color: #059669; }
        .stat-num.queue-color { color: #D97706; }

        .stat-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: #64748B;
        }

        .view-stat-divider {
          width: 1px;
          height: 24px;
          background: #E2E8F0;
        }

        .customer-tag-pill {
          font-size: 0.74rem;
          font-weight: 700;
          color: #475569;
          background: #F1F5F9;
          padding: 3px 10px;
          border-radius: 8px;
        }

        .view-file-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .view-file-card.is-printed {
          border-left: 4px solid #10B981;
          background: linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%);
        }

        .view-file-card.is-queued {
          border-left: 4px solid #F59E0B;
        }

        .view-file-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
        }

        .view-file-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .file-type-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          flex-shrink: 0;
        }

        .view-file-info {
          flex: 1;
          min-width: 0;
        }

        .view-file-name {
          font-size: 0.88rem;
          font-weight: 800;
          color: #0F172A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .view-file-meta {
          font-size: 0.72rem;
          color: #64748B;
          font-weight: 600;
        }

        .view-pages-tag {
          color: var(--accent-primary);
          font-weight: 700;
        }

        .view-file-note {
          font-size: 0.72rem;
          color: #4F46E5;
          background: #EEF2FF;
          padding: 4px 10px;
          border-radius: 8px;
          display: inline-block;
          font-weight: 600;
          width: fit-content;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .print-status-tag {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .print-status-tag.printed {
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
        }

        .print-status-tag.queue {
          background: #FFFBEB;
          color: #D97706;
          border: 1px solid #FDE68A;
        }

        .view-file-actions-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding-top: 10px;
          border-top: 1px solid #F1F5F9;
          width: 100%;
        }

        .view-card-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
          white-space: nowrap;
        }

        .btn-view {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          color: #334155;
        }

        .btn-view:hover {
          background: #F1F5F9;
          border-color: #CBD5E1;
        }

        .btn-download {
          background: #EEF2FF;
          border: 1px solid #C7D2FE;
          color: #4F46E5;
        }

        .btn-download:hover {
          background: #4F46E5;
          color: #FFFFFF;
          border-color: #4F46E5;
        }

        .view-text-card {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 12px 14px;
        }

        .empty-state {
          padding: 2.5rem 1.5rem;
          text-align: center;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 20px;
        }

        .empty-state-icon-wrap {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .empty-state-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
        }

        .empty-state-text {
          font-size: 0.78rem;
          color: #64748B;
          margin: 6px 0 16px 0;
          line-height: 1.5;
        }

        /* ── Mobile PDF/Image Preview Modal ── */
        .mobile-preview-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.72);
          backdrop-filter: blur(6px);
          z-index: 99999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: max(24px, env(safe-area-inset-top, 24px)) 0 0 0;
          animation: fadeIn 0.18s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mobile-preview-modal {
          width: 100%;
          max-width: 480px;
          height: calc(100dvh - 64px);
          max-height: calc(100dvh - 64px);
          background: #FFFFFF;
          border-radius: 20px 20px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.25);
          animation: slideUp 0.22s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .mobile-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #F1F5F9;
          background: #FFFFFF;
          flex-shrink: 0;
        }

        .mobile-preview-name {
          font-size: 0.82rem;
          font-weight: 800;
          color: #0F172A;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }

        .mobile-preview-body {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F8FAFC;
          padding: 8px;
        }

        .preview-action-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 800;
          text-decoration: none;
          flex-shrink: 0;
          transition: opacity 0.15s ease;
        }

        .preview-action-btn:hover {
          opacity: 0.8;
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
