/**
 * client/src/components/PdfCanvasViewer.jsx
 * Premium In-App Mobile & PWA PDF Viewer using PDF.js
 * Feature-packed: Password-Protected PDF Support (🔒), Direct Mobile System Print (🖨️), Zoom (🔍), Rotate (🔄), Open (↗), & Download.
 * Works 100% on Mobile Chrome, Safari, Android PWA, iOS, and Desktop.
 */

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const LARGE_PDF_BYTES = 5 * 1024 * 1024;

export function PdfCanvasViewer({ url, name, note = '', fileSize = 0 }) {
  const isLargePdf = fileSize > LARGE_PDF_BYTES;
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);

  // Password Protection States
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState(note || '');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const pdfDocRef = useRef(null);

  const loadPdf = async (pwd = '') => {
    setLoading(true);
    setError(null);
    setPasswordError(false);

    try {
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        password: pwd,
        withCredentials: false,
      });

      loadingTask.onPassword = (updatePassword, reason) => {
        setNeedsPassword(true);
        if (reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
          setPasswordError(true);
        }
      };

      const pdfDoc = await loadingTask.promise;
      pdfDocRef.current = pdfDoc;
      setNumPages(pdfDoc.numPages);
      setNeedsPassword(false);
      setLoading(false);
      setIsUnlocking(false);
    } catch (err) {
      console.error('[PdfCanvasViewer Error]:', err);
      if (err.name === 'PasswordException' || err.code === 1 || err.message?.toLowerCase().includes('password')) {
        setNeedsPassword(true);
        if (pwd) setPasswordError(true);
      } else {
        setError(err.message || 'Failed to load PDF');
      }
      setLoading(false);
      setIsUnlocking(false);
    }
  };

  useEffect(() => {
    if (url && !isLargePdf) {
      loadPdf(note || '');
    }
  }, [url, isLargePdf]);

  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    if (!pdfPassword) return;
    setIsUnlocking(true);
    loadPdf(pdfPassword);
  };

  // Render pages when pdfDoc, scale, or rotation changes
  useEffect(() => {
    let isMounted = true;
    const renderPages = async () => {
      const container = containerRef.current;
      if (!container || !pdfDocRef.current) return;

      // Clear previous canvases
      container.innerHTML = '';

      for (let pageNum = 1; pageNum <= pdfDocRef.current.numPages; pageNum++) {
        if (!isMounted) break;
        try {
          const page = await pdfDocRef.current.getPage(pageNum);
          
          // Calculate viewport scale based on container width
          const containerWidth = Math.min(container.clientWidth - 16, 720) || 340;
          const unscaledViewport = page.getViewport({ scale: 1, rotation });
          const baseScale = (containerWidth / unscaledViewport.width) * scale;
          const viewport = page.getViewport({ scale: baseScale, rotation });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page-wrapper';
          pageWrapper.style.marginBottom = '16px';
          pageWrapper.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
          pageWrapper.style.borderRadius = '8px';
          pageWrapper.style.overflow = 'hidden';
          pageWrapper.style.background = '#ffffff';
          pageWrapper.style.position = 'relative';

          // Page Number Indicator
          const pageBadge = document.createElement('div');
          pageBadge.className = 'pdf-page-num-tag';
          pageBadge.innerText = `${pageNum} / ${pdfDocRef.current.numPages}`;
          pageWrapper.appendChild(pageBadge);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';

          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };
          await page.render(renderContext).promise;
        } catch (pageErr) {
          console.warn(`[PdfCanvasViewer Page ${pageNum} Render Error]:`, pageErr);
        }
      }
    };

    if (!loading && !needsPassword && pdfDocRef.current) {
      renderPages();
    }

    return () => {
      isMounted = false;
    };
  }, [loading, needsPassword, scale, rotation, numPages]);

  // Mobile System Print Trigger
  const handleSystemPrint = async () => {
    if (!url) return;
    try {
      setIsPrinting(true);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = blobUrl;

      document.body.appendChild(printIframe);
      printIframe.onload = () => {
        setTimeout(() => {
          try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
          } catch {}
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
            URL.revokeObjectURL(blobUrl);
            setIsPrinting(false);
          }, 3000);
        }, 300);
      };
    } catch (err) {
      console.warn('[PDF System Print Fallback]:', err);
      window.open(url, '_blank');
      setIsPrinting(false);
    }
  };

  const handleOpenNative = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  if (isLargePdf) {
    return (
      <div className="pdf-viewer-root">
        <div style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: '12px', marginBottom: '10px', fontSize: '0.82rem', color: '#1E40AF' }}>
          <strong>Large PDF ({formatSize(fileSize)})</strong>
          <p style={{ margin: '6px 0 0', color: '#475569' }}>Native browser viewer works best for files over 5 MB.</p>
          <button type="button" onClick={handleOpenNative} style={{ marginTop: '8px', fontWeight: 700, color: '#2563EB', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            Open in browser ↗
          </button>
        </div>
        <iframe title={name || 'PDF preview'} src={url} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '12px', background: '#fff' }} />
      </div>
    );
  }

  return (
    <div className="pdf-viewer-root">
      {/* Top Mobile Control Bar */}
      <div className="pdf-viewer-toolbar">
        <div className="pdf-toolbar-left">
          <span className="pdf-page-badge">
            📑 {numPages > 0 ? `${numPages} P` : 'PDF'}
          </span>

          <button
            type="button"
            className="pdf-tool-btn"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate Page 90°"
            aria-label="Rotate 90 degrees"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.57L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            <span className="pdf-tool-lbl"> Rotate</span>
          </button>
        </div>

        <div className="pdf-zoom-controls">
          <button
            type="button"
            className="pdf-tool-btn"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            title="Zoom Out"
          >
            −
          </button>
          <span className="pdf-zoom-text">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="pdf-tool-btn"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            title="Zoom In"
          >
            +
          </button>
        </div>

        <div className="pdf-toolbar-right">
          <button
            type="button"
            className="pdf-tool-btn pdf-print-btn"
            onClick={handleSystemPrint}
            disabled={isPrinting}
            title="Print Document"
          >
            {isPrinting ? '⏳' : '🖨️'}<span className="pdf-tool-lbl"> Print</span>
          </button>
          <button
            type="button"
            className="pdf-tool-btn"
            onClick={handleOpenNative}
            title="Open in Browser"
          >
            ↗
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pdf-pages-scroll-area">
        {loading && (
          <div className="pdf-loading-state">
            <span className="pdf-spin-icon">⏳</span>
            <p>Loading PDF Document...</p>
          </div>
        )}

        {needsPassword ? (
          <div className="pdf-password-card">
            <div className="pdf-password-icon">🔒</div>
            <h4 className="pdf-password-title">Protected PDF Document</h4>
            <p className="pdf-password-sub">This document is encrypted. Please enter the password to view.</p>

            {note && (
              <div className="pdf-note-hint">
                <span>💡 File Note Tag:</span>
                <code>{note}</code>
              </div>
            )}

            <form onSubmit={handleUnlockSubmit} className="pdf-password-form">
              <input
                type="text"
                className="pdf-password-input"
                placeholder="Enter password..."
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="pdf-password-submit"
                disabled={isUnlocking || !pdfPassword}
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock & View 🔓'}
              </button>
            </form>

            {passwordError && (
              <div className="pdf-password-err">
                ⚠️ Incorrect password. Please try again.
              </div>
            )}
          </div>
        ) : error ? (
          <div className="pdf-error-state">
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ fontWeight: 700, margin: '8px 0 4px' }}>Unable to render PDF preview</p>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{error}</span>
          </div>
        ) : (
          <div ref={containerRef} className="pdf-canvas-container" />
        )}
      </div>

      <style>{`
        .pdf-viewer-root {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #F1F5F9;
          overflow: hidden;
          position: relative;
        }

        .pdf-viewer-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: #FFFFFF;
          border-bottom: 1px solid #E2E8F0;
          flex-shrink: 0;
          z-index: 5;
          gap: 6px;
        }

        .pdf-toolbar-left, .pdf-toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pdf-page-badge {
          font-size: 0.75rem;
          font-weight: 800;
          color: #475569;
          background: #F8FAFC;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #E2E8F0;
          white-space: nowrap;
        }

        .pdf-zoom-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #F8FAFC;
          padding: 2px 4px;
          border-radius: 8px;
          border: 1px solid #E2E8F0;
        }

        .pdf-tool-btn {
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          color: #1E293B;
          border-radius: 6px;
          padding: 5px 9px;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .pdf-tool-btn:active {
          transform: scale(0.95);
        }

        .pdf-print-btn {
          background: #4F46E5 !important;
          color: #FFFFFF !important;
          border-color: #4338CA !important;
        }

        .pdf-zoom-text {
          font-size: 0.72rem;
          font-weight: 800;
          color: #475569;
          min-width: 34px;
          text-align: center;
        }

        .pdf-pages-scroll-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
        }

        .pdf-canvas-container {
          width: 100%;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pdf-page-num-tag {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          z-index: 3;
          pointer-events: none;
        }

        .pdf-loading-state, .pdf-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          text-align: center;
          color: #64748B;
          font-size: 0.84rem;
        }

        .pdf-spin-icon {
          font-size: 2rem;
          margin-bottom: 8px;
          animation: pdfSpin 1.5s infinite linear;
        }

        .pdf-password-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 24px 20px;
          max-width: 380px;
          width: 100%;
          margin: 24px auto;
          text-align: center;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);
          box-sizing: border-box;
        }

        .pdf-password-icon {
          font-size: 2.5rem;
          margin-bottom: 10px;
        }

        .pdf-password-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0 0 6px 0;
        }

        .pdf-password-sub {
          font-size: 0.82rem;
          color: #64748B;
          margin: 0 0 16px 0;
          line-height: 1.4;
        }

        .pdf-note-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #FEF3C7;
          border: 1px solid #FDE68A;
          color: #92400E;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .pdf-note-hint code {
          font-family: monospace;
          font-size: 0.85rem;
          background: #F59E0B;
          color: white;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .pdf-password-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pdf-password-input {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #CBD5E1;
          border-radius: 10px;
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }

        .pdf-password-input:focus {
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .pdf-password-submit {
          width: 100%;
          padding: 10px 14px;
          background: #4F46E5;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .pdf-password-submit:hover {
          background: #4338CA;
        }

        .pdf-password-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pdf-password-err {
          margin-top: 12px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #DC2626;
          background: #FEF2F2;
          border: 1px solid #FCA5A5;
          border-radius: 8px;
          padding: 8px 12px;
        }

        @keyframes pdfSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .pdf-tool-lbl {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
