/**
 * client/src/components/FilePreviewModal.jsx
 * Light Theme Responsive Modal with In-App Inline PDF, Image, Video & Audio Previews
 * Mobile: PDF via <object> embed + download fallback; Bottom-sheet slide-up on mobile
 */

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { config } from '../config';
import { PdfCanvasViewer } from './PdfCanvasViewer';

const isMobile = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

export function FilePreviewModal({ file, onClose }) {
  const [imgRotation, setImgRotation] = useState(0);
  if (!file) return null;

  const fileId = file.uuid || file.id || file._id;
  const name = file.originalName || file.name || 'File Preview';
  const mime = file.mimeType || '';

  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const mobile = isMobile();

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

  const handlePrint = () => {
    const iframe = document.querySelector('.preview-pdf-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (e) {
        console.warn('Iframe print failed:', e);
      }
    }
    const printWin = window.open(previewUrl, '_blank');
    if (printWin) {
      printWin.onload = () => {
        printWin.print();
      };
    }
  };

  const handlePrintImage = () => {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Image - ${name}</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; transform: rotate(${imgRotation}deg); }
              @media print {
                body { height: auto; }
                img { max-width: 100%; height: auto; }
              }
            </style>
          </head>
          <body>
            <img src="${previewUrl}" onload="window.focus(); window.print(); window.close();" />
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className={`preview-modal-overlay ${mobile ? 'preview-mobile' : ''}`} onClick={onClose}>
        <motion.div
          initial={mobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={mobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={mobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.22 }}
          className={`preview-modal-container ${mobile ? 'preview-modal-mobile' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="preview-modal-header">
            <div className="preview-modal-header-top">
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
              <button
                onClick={onClose}
                className="btn-modal-close"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="preview-modal-actions">
              {isImage && (
                <button
                  type="button"
                  onClick={() => setImgRotation((r) => (r + 90) % 360)}
                  className="btn-modal-action"
                  title="Rotate Image 90°"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.57L21 8" />
                    <polyline points="21 3 21 8 16 8" />
                  </svg>
                  <span className="btn-lbl"> Rotate</span>
                </button>
              )}
              {isImage && (
                <button
                  type="button"
                  onClick={handlePrintImage}
                  className="btn-modal-action btn-print-action"
                  style={{ background: '#4F46E5', color: '#FFF' }}
                  title="Print Image"
                >
                  <span>🖨️</span>
                  <span className="btn-lbl"> Print</span>
                </button>
              )}
              <button
                onClick={handleOpenInNewTab}
                className="btn-modal-action btn-open-tab"
                title="Open in New Tab"
              >
                <span>↗</span>
                <span className="btn-lbl"> Open</span>
              </button>
              {!mobile && isPdf && (
                <button
                  onClick={handlePrint}
                  className="btn-modal-action btn-print-action"
                  style={{ background: '#4F46E5', color: '#FFF' }}
                  title="Print Document"
                >
                  <span>🖨️</span>
                  <span className="btn-lbl"> Print</span>
                </button>
              )}
              <button
                onClick={handleDownload}
                className="btn-modal-action btn-download-action"
                title="Download File"
              >
                <span>⬇</span>
                <span className="btn-lbl"> Download</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="preview-modal-body">
            {isImage && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'hidden', padding: '12px' }}>
                <img
                  src={previewUrl}
                  alt={name}
                  className="preview-img-element"
                  style={{
                    transform: `rotate(${imgRotation}deg)`,
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}

            {isPdf && (
              mobile ? (
                <PdfCanvasViewer url={previewUrl} name={name} note={file.note} />
              ) : (
                <iframe
                  src={`${previewUrl}#zoom=100&toolbar=1&navpanes=0`}
                  title={name}
                  className="preview-pdf-iframe"
                  style={{ width: '100%', height: '100%', minHeight: '650px', border: 'none', borderRadius: '8px' }}
                />
              )
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

            {/* Unsupported file type */}
            {!isImage && !isPdf && !isVideo && !isAudio && (
              <div className="pdf-mobile-fallback">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                <p style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: '6px' }}>{name}</p>
                <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '1.5rem' }}>
                  Preview not available for this file type.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    background: '#4F46E5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  ⬇ Download File
                </button>
              </div>
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

          .preview-modal-overlay.preview-mobile {
            align-items: flex-end;
            padding: max(20px, env(safe-area-inset-top, 20px)) 0 0 0;
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

          .preview-modal-mobile {
            max-width: 100%;
            max-height: calc(100dvh - 60px);
            height: calc(100dvh - 60px);
            border-radius: 20px 20px 0 0;
            border: none;
          }

          .preview-modal-header {
            display: flex;
            flex-direction: column;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #E2E8F0;
            background: #F8FAFC;
            gap: 8px;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
          }

          .preview-modal-header-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 8px;
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
            gap: 6px;
            overflow-x: auto;
            width: 100%;
            box-sizing: border-box;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 2px;
          }

          .preview-modal-actions::-webkit-scrollbar {
            display: none;
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
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 1.5px solid #FCA5A5;
            background: #FEF2F2;
            color: #DC2626;
            font-size: 16px;
            font-weight: 900;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .preview-modal-body {
            flex: 1;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            min-height: 300px;
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

          .pdf-mobile-fallback {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1.5rem;
            text-align: center;
            width: 100%;
          }

          /* ── Mobile Responsive Breakpoints ── */
          @media (max-width: 640px) {
            .btn-lbl {
              display: none !important;
            }

            .preview-modal-overlay {
              padding: max(24px, env(safe-area-inset-top, 24px)) 0 0 0;
            }

            .preview-modal-container {
              max-height: calc(100dvh - 64px);
              height: calc(100dvh - 64px);
              border-radius: 20px 20px 0 0;
            }

            .preview-modal-header {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              padding: 0.65rem 0.85rem;
            }

            .preview-modal-header-top {
              width: auto;
              flex: 1;
              min-width: 0;
            }

            .preview-modal-actions {
              width: auto;
              overflow-x: visible;
              gap: 5px;
            }

            .preview-modal-name {
              font-size: 0.82rem;
              max-width: 120px;
            }

            .btn-modal-action {
              padding: 6px 10px;
              font-size: 0.95rem;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }

            .btn-modal-action svg {
              margin-right: 0 !important;
            }

            .preview-modal-body {
              padding: 0.5rem;
              min-height: 240px;
            }

            .preview-iframe-element, .preview-img-element, .preview-video-element {
              height: 65vh;
              max-height: 65vh;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>,
    document.body
  );
}

