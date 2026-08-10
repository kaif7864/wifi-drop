/**
 * client/src/components/FileCard.jsx
 * Displays a received file with full preview, open-in-tab, direct download, and delete actions
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { config } from '../config';
import { PdfCanvasViewer } from './PdfCanvasViewer';

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

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });

  return `${dateStr}, ${timeStr}`;
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

import { isFileInBill, toggleFileInBill } from '../utils/billManager';

export function FileCard({ file, onDelete, onTogglePrint }) {
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileId = file.uuid || file.id || file._id;
  const [addedToBill, setAddedToBill] = useState(() => isFileInBill(fileId));
  const isPrinted = file.printedStatus || false;

  // Sync bill status with global storage updates
  useEffect(() => {
    const syncBillState = () => {
      setAddedToBill(isFileInBill(fileId));
    };
    syncBillState();
    window.addEventListener('wifidrop_bill_items_updated', syncBillState);
    return () => window.removeEventListener('wifidrop_bill_items_updated', syncBillState);
  }, [fileId]);

  const isImage = IMAGE_TYPES.includes(file.mimeType);
  const isPdf = file.mimeType === PDF_TYPE;
  const isVideo = VIDEO_TYPES.some((t) => file.mimeType?.includes(t) || file.mimeType?.startsWith('video/'));
  const isAudio = AUDIO_TYPES.some((t) => file.mimeType?.includes(t) || file.mimeType?.startsWith('audio/'));
  
  const canPreview = isImage || isPdf || isVideo || isAudio;

  const handleAddToBill = (e) => {
    e.stopPropagation();
    const res = toggleFileInBill(file);
    setAddedToBill(res.added);
  };

  const getFullUrl = (urlStr) => {
    if (!urlStr) return '';
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('blob:')) {
      return urlStr;
    }
    return `${config.serverUrl}${urlStr}`;
  };

  const previewUrl = file.isP2P ? file.previewUrl : getFullUrl(`/api/files/${fileId}/preview`);
  const downloadUrl = file.isP2P ? file.downloadUrl : getFullUrl(`/api/files/${fileId}/download`);

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

  const togglePrint = async () => {
    if (onTogglePrint) {
      onTogglePrint(file);
    } else {
      try {
        await axios.patch(`${config.serverUrl}/api/files/${file.uuid || file.id || file._id}/print`);
      } catch {}
    }
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
        <div className="file-left" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div className="file-icon" style={{ flexShrink: 0 }}>{getFileIcon(file.mimeType)}</div>
          <div className="file-info" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <p className="file-name" title={file.originalName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, width: '100%' }}>
              {file.originalName}
            </p>
            {file.note && (
              <div
                className="file-password-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  color: '#92400E',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginTop: '3px',
                  marginBottom: '2px',
                  cursor: 'pointer',
                  width: 'fit-content',
                  maxWidth: '100%',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    navigator.clipboard.writeText(file.note);
                  } catch {}
                }}
                title="Click to copy file password / note"
              >
                <span>🔑</span>
                <span style={{ fontFamily: 'monospace', color: '#B45309', fontWeight: 800 }}>{file.note}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>📋 Copy</span>
              </div>
            )}
            <div className="file-meta">
              <span>{formatBytes(file.size)}</span>
              {file.pageCount && file.pageCount > 1 && (
                <>
                  <span className="meta-dot">·</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>📄 {file.pageCount} Pages</span>
                </>
              )}
              <span className="meta-dot">·</span>
              <span className="file-timestamp-tag">🕒 {formatDateTime(file.savedAt || file.uploadedAt || file.createdAt)}</span>
              {file.deviceName && (
                <>
                  <span className="meta-dot">·</span>
                  <span className="device-tag">{file.deviceName}</span>
                </>
              )}
              {file.customerName && (
                <>
                  <span className="meta-dot">·</span>
                  <span className="customer-tag" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                    👤 {file.customerName}
                  </span>
                </>
              )}
              {file.isP2P && <span className="badge badge-accent">P2P</span>}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="file-actions">
          <div className="file-pill-actions">
            <button
              className={`btn-print-toggle ${addedToBill ? 'printed' : ''}`}
              style={{ background: addedToBill ? '#ECFDF5' : '#EEF2FF', color: addedToBill ? '#059669' : '#4F46E5', border: '1px solid #C7D2FE' }}
              title="Add File to Customer Bill Queue"
              onClick={handleAddToBill}
            >
              {addedToBill ? '✓ Bill' : '💳 Add to Bill'}
            </button>
            <button
              className={`btn-print-toggle ${isPrinted ? 'printed' : ''}`}
              title="Toggle Printed Status"
              onClick={togglePrint}
            >
              {isPrinted ? '✓ Printed' : '🖨️ Print'}
            </button>
          </div>

          <div className="file-icon-actions">
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
        </div>
      </motion.div>

      {/* Preview modal */}
      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <span className="preview-title">{file.originalName}</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                  Download ⬇
                </button>
                <button className="btn-icon btn-close-preview" onClick={() => setShowPreview(false)}>✕</button>
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
                <PdfCanvasViewer url={previewUrl} name={file.originalName} />
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

        .file-pill-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .file-icon-actions {
          display: flex;
          align-items: center;
          gap: 6px;
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

        /* ── Mobile Responsive Breakpoints ── */
        @media (max-width: 768px) {
          .file-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
            padding: 0.85rem 1rem;
          }

          .file-actions {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            padding-top: 8px;
            border-top: 1px solid var(--border);
            width: 100%;
            box-sizing: border-box;
          }

          .file-pill-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
          }

          .file-icon-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
          }

          .file-actions .btn-print-toggle {
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .file-actions .btn-icon {
            width: 30px;
            height: 30px;
            min-width: 30px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            border-radius: 8px;
          }

          .preview-overlay {
            padding: max(24px, env(safe-area-inset-top, 24px)) 0 0 0;
            align-items: flex-end;
          }

          .preview-modal {
            max-height: calc(100dvh - 64px);
            height: calc(100dvh - 64px);
            border-radius: 20px 20px 0 0;
            border: none;
          }

          .preview-header {
            padding: 0.75rem 1rem;
          }

          .preview-title {
            max-width: 150px;
            font-size: 0.82rem;
          }

          .btn-close-preview {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #FEF2F2;
            color: #DC2626;
            border: 1.5px solid #FCA5A5;
            font-size: 16px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .preview-body {
            padding: 0.5rem;
            min-height: 220px;
          }
        }
      `}</style>
    </>
  );
}
