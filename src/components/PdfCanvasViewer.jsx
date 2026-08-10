/**
 * client/src/components/PdfCanvasViewer.jsx
 * HTML5 Canvas-based PDF Viewer using PDF.js
 * Renders PDF pages directly inside web app without relying on browser PDF plugins or native "Open" buttons.
 * Works 100% on Mobile Chrome/Safari, Android, iOS, and Desktop.
 */

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker via cdnjs matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function PdfCanvasViewer({ url, name }) {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.2);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: url,
          withCredentials: false,
        });

        const pdfDoc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        console.error('[PdfCanvasViewer Error]:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    if (url) {
      loadPdf();
    }

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Render pages when pdfDoc or scale changes
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
          const containerWidth = container.clientWidth - 24 || 340;
          const unscaledViewport = page.getViewport({ scale: 1 });
          const calculatedScale = (containerWidth / unscaledViewport.width) * scale;
          const viewport = page.getViewport({ scale: calculatedScale });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page-wrapper';
          pageWrapper.style.marginBottom = '16px';
          pageWrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          pageWrapper.style.borderRadius = '8px';
          pageWrapper.style.overflow = 'hidden';
          pageWrapper.style.background = '#ffffff';
          pageWrapper.style.position = 'relative';

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

    if (!loading && pdfDocRef.current) {
      renderPages();
    }

    return () => {
      isMounted = false;
    };
  }, [loading, scale, numPages]);

  return (
    <div className="pdf-viewer-root">
      {/* Controls Bar */}
      <div className="pdf-viewer-toolbar">
        <div className="pdf-page-badge">
          {numPages > 0 ? `📑 ${numPages} Page${numPages > 1 ? 's' : ''}` : 'Document'}
        </div>
        <div className="pdf-zoom-controls">
          <button
            type="button"
            className="pdf-tool-btn"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            title="Zoom Out"
          >
            🔍−
          </button>
          <span className="pdf-zoom-text">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="pdf-tool-btn"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            title="Zoom In"
          >
            🔍+
          </button>
        </div>
      </div>

      {/* Main Pages Canvas Container */}
      <div className="pdf-pages-scroll-area">
        {loading && (
          <div className="pdf-loading-state">
            <span className="pdf-spin-icon">⏳</span>
            <p>Rendering PDF Pages...</p>
          </div>
        )}

        {error && (
          <div className="pdf-error-state">
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ fontWeight: 700, margin: '8px 0 4px' }}>Unable to render PDF preview</p>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{error}</span>
          </div>
        )}

        <div ref={containerRef} className="pdf-canvas-container" />
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
          padding: 8px 12px;
          background: #FFFFFF;
          border-bottom: 1px solid #E2E8F0;
          flex-shrink: 0;
          z-index: 2;
        }

        .pdf-page-badge {
          font-size: 0.78rem;
          font-weight: 800;
          color: #475569;
          background: #F8FAFC;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #E2E8F0;
        }

        .pdf-zoom-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pdf-tool-btn {
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          color: #1E293B;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .pdf-tool-btn:hover {
          background: #F1F5F9;
        }

        .pdf-zoom-text {
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748B;
          min-width: 36px;
          text-align: center;
        }

        .pdf-pages-scroll-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px;
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

        @keyframes pdfSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
