/**
 * client/src/components/FilePreviewModal.jsx
 * Light Theme Responsive Modal with In-App Inline PDF, Image, Video & Audio Previews
 */

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { config } from '../config';

export function FilePreviewModal({ file, onClose }) {
  if (!file) return null;

  const fileId = file.uuid || file.id || file._id;
  const name = file.originalName || file.name || 'File Preview';
  const mime = file.mimeType || '';

  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');

  const getFullUrl = (urlStr) => {
    if (!urlStr) return '';
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('blob:')) {
      return urlStr;
    }
    return `${config.serverUrl}${urlStr}`;
  };

  const previewUrl = file.isP2P && file.previewUrl
    ? file.previewUrl
    : getFullUrl(`/api/files/${fileId}/preview`);

  const downloadUrl = file.isP2P && file.downloadUrl
    ? file.downloadUrl
    : getFullUrl(`/api/files/${fileId}/download`);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenInNewTab = () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <AnimatePresence>
      <div className="preview-modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="preview-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="preview-modal-header">
            <div className="preview-modal-info">
              <span className="preview-type-icon">
                {isImage ? '🖼️' : isPdf ? '📄' : isVideo ? '🎬' : isAudio ? '🎵' : '📁'}
              </span>
              <span className="preview-modal-name" title={name}>
                {name}
              </span>
              {file.pageCount && file.pageCount > 1 && (
                <span className="page-count-badge">
                  {file.pageCount} Pages
                </span>
              )}
            </div>
            <div className="preview-modal-actions">
              <button
                onClick={handleOpenInNewTab}
                className="btn-modal-action btn-open-tab"
              >
                Open ↗
              </button>
              <button
                onClick={handleDownload}
                className="btn-modal-action btn-download-action"
              >
                Download ⬇
              </button>
              <button
                onClick={onClose}
                className="btn-modal-close"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="preview-modal-body">
            {isImage && (
              <img
                src={previewUrl}
                alt={name}
                className="preview-img-element"
              />
            )}

            {isPdf && (
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                title={name}
                className="preview-iframe-element"
              />
            )}

            {isVideo && (
              <video
                controls
                src={previewUrl}
                className="preview-video-element"
                autoPlay
              />
            )}

            {isAudio && (
              <audio
                controls
                src={previewUrl}
                className="preview-audio-element"
                autoPlay
              />
            )}
          </div>
        </motion.div>

        <style>{`
          .preview-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }

          .preview-modal-container {
            background: #ffffff;
            border-radius: 20px;
            max-width: 920px;
            max-height: 88vh;
            width: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid #E2E8F0;
          }

          .preview-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #E2E8F0;
            background: #F8FAFC;
            gap: 12px;
          }

          .preview-modal-info {
            display: flex;
            align-items: center;
            gap: 8px;
            overflow: hidden;
            flex: 1;
            min-width: 0;
          }

          .preview-type-icon {
            font-size: 1.2rem;
            flex-shrink: 0;
          }

          .preview-modal-name {
            font-size: 0.92rem;
            font-weight: 700;
            color: #0F172A;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .page-count-badge {
            font-size: 0.75rem;
            font-weight: 800;
            background: #EEF2FF;
            color: #4F46E5;
            padding: 2px 8px;
            border-radius: 999px;
            flex-shrink: 0;
          }

          .preview-modal-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .btn-modal-action {
            padding: 6px 12px;
            font-size: 0.78rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
          }

          .btn-open-tab {
            background: #FFFFFF;
            color: #475569;
            border: 1px solid #CBD5E1;
          }

          .btn-download-action {
            background: #4F46E5;
            color: #FFFFFF;
          }

          .btn-modal-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid #CBD5E1;
            background: #F1F5F9;
            color: #64748B;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .preview-modal-body {
            flex: 1;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.25rem;
            min-height: 380px;
            background: #F1F5F9;
          }

          .preview-img-element {
            max-width: 100%;
            max-height: 68vh;
            border-radius: 12px;
            object-fit: contain;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }

          .preview-iframe-element {
            width: 100%;
            height: 68vh;
            border: none;
            border-radius: 12px;
            background: #ffffff;
          }

          .preview-video-element {
            max-width: 100%;
            max-height: 68vh;
            border-radius: 12px;
          }

          .preview-audio-element {
            width: 100%;
            max-width: 480px;
          }

          /* ── Mobile Responsive Breakpoints ── */
          @media (max-width: 640px) {
            .preview-modal-overlay {
              padding: 0.5rem;
            }

            .preview-modal-container {
              max-height: 94vh;
              border-radius: 16px;
            }

            .preview-modal-header {
              padding: 0.75rem 1rem;
              gap: 8px;
            }

            .preview-modal-name {
              font-size: 0.82rem;
              max-width: 130px;
            }

            .btn-modal-action {
              padding: 5px 8px;
              font-size: 0.72rem;
            }

            .preview-modal-body {
              padding: 0.75rem;
              min-height: 240px;
            }

            .preview-iframe-element, .preview-img-element, .preview-video-element {
              height: 60vh;
              max-height: 60vh;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>,
    document.body
  );
}
