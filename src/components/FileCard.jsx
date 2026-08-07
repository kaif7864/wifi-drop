/**
 * client/src/components/FileCard.jsx
 * Displays a received file with full preview, open-in-tab, direct download, and delete actions
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { config } from '../config';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const PDF_TYPE = 'application/pdf';
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(mimeType = '') {
  if (IMAGE_TYPES.includes(mimeType)) return '🖼️';
  if (mimeType === PDF_TYPE) return '📄';
  if (VIDEO_TYPES.some((t) => mimeType.includes(t) || mimeType.startsWith('video/'))) return '🎬';
  if (AUDIO_TYPES.some((t) => mimeType.includes(t) || mimeType.startsWith('audio/'))) return '🎵';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('javascript')) return '📝';
  return '📁';
}

export function FileCard({ file, onDelete }) {
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isImage = IMAGE_TYPES.includes(file.mimeType);
  const isPdf = file.mimeType === PDF_TYPE;
  const isVideo = VIDEO_TYPES.some((t) => file.mimeType?.includes(t) || file.mimeType?.startsWith('video/'));
  const isAudio = AUDIO_TYPES.some((t) => file.mimeType?.includes(t) || file.mimeType?.startsWith('audio/'));
  
  const canPreview = isImage || isPdf || isVideo || isAudio;

  const previewUrl = file.isP2P ? file.previewUrl : `${config.serverUrl}${file.previewUrl}`;
  const downloadUrl = file.isP2P ? file.downloadUrl : `${config.serverUrl}${file.downloadUrl}`;

  // Direct trigger download handling
  const handleDownload = async () => {
    if (file.isP2P) {
      const a = document.createElement('a');
      a.href = file.downloadUrl;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    try {
      setIsDownloading(true);
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback window open
      window.open(downloadUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  const [isPrinted, setIsPrinted] = useState(file.printedStatus || false);

  const togglePrint = async () => {
    const nextVal = !isPrinted;
    setIsPrinted(nextVal);
    try {
      await axios.patch(`${config.serverUrl}/api/files/${file.uuid || file.id || file._id}/print`);
    } catch {}
  };

  return (
    <>
      <motion.div
        className={`file-card glass-card ${isPrinted ? 'file-printed' : ''}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        layout
      >
        {/* Left: icon + info */}
        <div className="file-left">
          <div className="file-icon">{getFileIcon(file.mimeType)}</div>
          <div className="file-info">
            <p className="file-name" title={file.originalName}>
              {file.originalName}
            </p>
            <div className="file-meta">
              <span>{formatBytes(file.size)}</span>
              <span className="meta-dot">·</span>
              <span>{formatTime(file.savedAt)}</span>
              {file.deviceName && (
                <>
                  <span className="meta-dot">·</span>
                  <span className="device-tag">{file.deviceName}</span>
                </>
              )}
              {file.isP2P && <span className="badge badge-accent">P2P</span>}
              {isPrinted && <span className="badge badge-success">✓ Printed</span>}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="file-actions">
          <button
            className={`btn-print-toggle ${isPrinted ? 'printed' : ''}`}
            title="Toggle Printed Status"
            onClick={togglePrint}
          >
            {isPrinted ? '✓ Printed' : '🖨️ Mark Printed'}
          </button>
          {canPreview && (
            <button
              className="btn-icon"
              title="Quick Preview"
              onClick={() => setShowPreview(true)}
            >
              👁️
            </button>
          )}
          <button
            className="btn-icon"
            title="Open in new tab"
            onClick={handleOpenInNewTab}
          >
            ↗️
          </button>
          <button
            className="btn-icon"
            title="Download file"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '⏳' : '⬇️'}
          </button>
          <button
            className="btn-icon btn-danger-icon"
            title="Delete file"
            onClick={() => onDelete(file.uuid || file.id || file._id)}
          >
            🗑️
          </button>
        </div>
      </motion.div>

      {/* Preview modal */}
      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <span className="preview-title">{file.originalName}</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={handleOpenInNewTab}>
                  Open ↗
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                  Download ⬇
                </button>
                <button className="btn-icon" onClick={() => setShowPreview(false)}>✕</button>
              </div>
            </div>
            <div className="preview-body">
              {isImage && (
                <img
                  src={previewUrl}
                  alt={file.originalName}
                  className="preview-image"
                />
              )}
              {isPdf && (
                <iframe
                  src={previewUrl}
                  title={file.originalName}
                  className="preview-iframe"
                />
              )}
              {isVideo && (
                <video controls src={previewUrl} className="preview-video" autoPlay />
              )}
              {isAudio && (
                <audio controls src={previewUrl} className="preview-audio" autoPlay />
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .file-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          gap: var(--space-4);
        }
        .file-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          min-width: 0;
          flex: 1;
        }
        .file-icon {
          font-size: 1.6rem;
          flex-shrink: 0;
        }
        .file-info {
          min-width: 0;
          flex: 1;
        }
        .file-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-top: 2px;
          flex-wrap: wrap;
        }
        .meta-dot { opacity: 0.5; }
        .device-tag {
          color: var(--accent-primary);
          font-weight: 500;
        }
        .file-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .btn-danger-icon:hover {
          color: var(--danger) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
          background: var(--danger-light) !important;
        }

        /* Preview modal */
        .preview-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(6px);
          z-index: var(--z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
        }
        .preview-modal {
          background: #FFFFFF;
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          width: 100%;
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border);
          background: var(--bg-primary);
        }
        .preview-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 400px;
        }
        .preview-body {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          min-height: 320px;
          background: var(--bg-tertiary);
        }
        .preview-image {
          max-width: 100%;
          max-height: 65vh;
          border-radius: var(--radius-md);
          object-fit: contain;
          box-shadow: var(--shadow-md);
        }
        .preview-iframe {
          width: 100%;
          height: 65vh;
          border: none;
          border-radius: var(--radius-md);
        }
        .preview-video {
          max-width: 100%;
          max-height: 65vh;
          border-radius: var(--radius-md);
        }
        .preview-audio {
          width: 100%;
          max-width: 500px;
        }
      `}</style>
    </>
  );
}
