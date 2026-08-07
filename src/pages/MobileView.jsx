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
import { config } from '../config';

const DEVICE_NAME_KEY = 'wifidrop_device_name';

function getSavedDeviceName() {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY) || 'Mobile Device';
  } catch {
    return 'Mobile Device';
  }
}

function getSessionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session') || null;
}

export function MobileView() {
  const deviceName = getSavedDeviceName();
  const sessionId = useMemo(() => getSessionIdFromUrl(), []);
  
  const { socket, connected } = useSocket('mobile', deviceName, sessionId);
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

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Trigger WebRTC peer connect attempt when socket connects in a session
  useEffect(() => {
    if (connected && sessionId) {
      initiateConnect();
    }
  }, [connected, sessionId, initiateConnect]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) setSelectedFiles(files);
  };

  // Hybrid file upload strategy: try P2P WebRTC DataChannel if open, else HTTP upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploadStatus(null);

    // Strategy 1: Attempt WebRTC P2P Transfer if DataChannel is connected
    if (peerState === 'connected') {
      try {
        setIsP2pUploading(true);
        setP2pProgress(0);
        for (const file of selectedFiles) {
          await sendFileP2P(file, deviceName, (progress) => {
            setP2pProgress(progress);
          });
        }
        setUploadStatus('success');
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        return;
      } catch (err) {
        console.warn('[Hybrid Transfer] WebRTC P2P transfer failed, falling back to HTTP Upload:', err);
      } finally {
        setIsP2pUploading(false);
      }
    }

    // Strategy 2: Fallback to HTTP API (Local WiFi / Cloud Relay)
    try {
      await uploadFiles(selectedFiles, deviceName, sessionId);
      setUploadStatus('success');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    } catch {
      setUploadStatus('error');
    }
  };

  const handleTextSend = async () => {
    if (!textInput.trim()) return;
    try {
      setTextStatus(null);
      await sendText(textInput.trim(), deviceName, sessionId);
      setTextStatus('success');
      setTextInput('');
    } catch {
      setTextStatus('error');
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
          <span className={`dot ${connected ? 'dot-success' : 'dot-muted'}`} />
          <span className="mobile-status-text">
            {peerState === 'connected'
              ? 'P2P WebRTC Direct'
              : connected
              ? 'Connected (Relay)'
              : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Sub-header */}
      <div className="mobile-sub-header">
        <p className="mobile-sub-title">Send to Laptop</p>
        {sessionId && (
          <p className="mobile-session-tag">Session ID: {sessionId}</p>
        )}
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
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                id="file-picker"
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
                <label htmlFor="file-picker" className="pick-card glass-card">
                  <span className="pick-icon">📁</span>
                  <span className="pick-label">Choose Files</span>
                  <span className="pick-sub">Any file type</span>
                </label>
                <label htmlFor="camera-picker" className="pick-card glass-card">
                  <span className="pick-icon">📷</span>
                  <span className="pick-label">Camera</span>
                  <span className="pick-sub">Capture & send</span>
                </label>
              </div>

              {/* Selected file list */}
              {selectedFiles.length > 0 && (
                <div className="selected-files glass-card">
                  <p className="selected-label">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </p>
                  {selectedFiles.map((f, i) => (
                    <div key={i} className="selected-file-row">
                      <span className="selected-file-name">{f.name}</span>
                      <span className="selected-file-size">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
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
          margin: 0 auto;
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
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
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

        .selected-file-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
        }

        .selected-file-name {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
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
