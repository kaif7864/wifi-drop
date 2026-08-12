/**
 * ScannerCamera.jsx — Live camera preview UI (mock for UI-only phase)
 */

import { ScannerHeader, ScannerSteps } from './ScannerHeader';

export function ScannerCamera({ pageCount, onCapture, onReviewPages, onClose }) {
  return (
    <div className="doc-scanner-shell">
      <ScannerHeader
        icon="📝"
        title="Scan Document"
        subtitle={<>Align page · <strong>Multi-page PDF</strong></>}
        onClose={onClose}
      />
      <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={0} />

      <div className="doc-scanner-camera-wrap">
        <div className="doc-scanner-viewfinder">
          <div className="doc-scanner-camera-mock">
            <div className="doc-scanner-camera-mock-surface" />
            <div className="doc-scanner-camera-mock-doc">
              <div className="doc-scanner-camera-mock-lines">
                <div className="doc-scanner-mock-line long" />
                <div className="doc-scanner-mock-line medium" />
                <div className="doc-scanner-mock-line long" />
                <div className="doc-scanner-mock-line short" />
                <div className="doc-scanner-mock-line long" />
                <div className="doc-scanner-mock-line medium" />
              </div>
            </div>
          </div>

          <div className="doc-scanner-edge-overlay">
            <div className="doc-scanner-edge-polygon">
              <span className="doc-scanner-edge-label">Document detected</span>
              <span className="doc-scanner-corner-dot tl" />
              <span className="doc-scanner-corner-dot tr" />
              <span className="doc-scanner-corner-dot bl" />
              <span className="doc-scanner-corner-dot br" />
            </div>
          </div>

          {pageCount > 0 && (
            <button type="button" className="doc-scanner-page-count-pill" onClick={onReviewPages}>
              📄 {pageCount} page{pageCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <p className="doc-scanner-hint">
          <span className="doc-scanner-hint-dot" />
          Hold steady — document inside the frame
        </p>
      </div>

      <footer className="doc-scanner-camera-footer">
        <div className="doc-scanner-camera-controls">
          <button type="button" className="doc-scanner-side-btn" aria-label="Import from gallery">
            🖼️
          </button>
          <button type="button" className="doc-scanner-capture-btn" onClick={onCapture} aria-label="Capture page">
            <span className="doc-scanner-capture-inner" />
          </button>
          <button type="button" className="doc-scanner-side-btn" aria-label="Switch camera">
            🔄
          </button>
        </div>
      </footer>
    </div>
  );
}
