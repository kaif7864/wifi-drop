/**
 * ScannerCamera.jsx — Live camera capture with getUserMedia
 */

import { useRef } from 'react';
import { ScannerHeader, ScannerSteps } from './ScannerHeader';
import { useScannerCamera } from '../../hooks/useScannerCamera';
import { captureVideoFrame } from '../../utils/documentScan/processScanPage';

export function ScannerCamera({
  isActive,
  pageCount,
  onCapture,
  onImportImage,
  onReviewPages,
  onClose,
}) {
  const galleryRef = useRef(null);
  const { videoRef, ready, error, flipCamera, retry } = useScannerCamera(isActive);

  const handleCapture = () => {
    if (!videoRef.current || !ready) return;
    try {
      const frame = captureVideoFrame(videoRef.current);
      onCapture({
        dataUrl: frame.dataUrl,
        width: frame.width,
        height: frame.height,
        canvas: frame.canvas,
      });
    } catch (err) {
      console.warn('[ScannerCamera] Capture failed:', err.message);
    }
  };

  const handleGalleryChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportImage(file);
    e.target.value = '';
  };

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
          {error ? (
            <div className="doc-scanner-camera-error">
              <span className="doc-scanner-camera-error-icon">📷</span>
              <p>{error}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={retry}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="doc-scanner-camera-video"
                autoPlay
                muted
                playsInline
              />
              {!ready && (
                <div className="doc-scanner-camera-loading">
                  <div className="doc-scanner-spinner" />
                  <span>Starting camera...</span>
                </div>
              )}
            </>
          )}

          {pageCount > 0 && (
            <button type="button" className="doc-scanner-page-count-pill" onClick={onReviewPages}>
              📄 {pageCount} page{pageCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <p className="doc-scanner-hint">
          <span className="doc-scanner-hint-dot" />
          {ready ? 'Hold steady — tap capture when ready' : 'Allow camera access to scan'}
        </p>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleGalleryChange}
      />

      <footer className="doc-scanner-camera-footer">
        <div className="doc-scanner-camera-controls">
          <button
            type="button"
            className="doc-scanner-side-btn"
            aria-label="Import from gallery"
            onClick={() => galleryRef.current?.click()}
          >
            🖼️
          </button>
          <button
            type="button"
            className="doc-scanner-capture-btn"
            onClick={handleCapture}
            disabled={!ready || !!error}
            aria-label="Capture page"
          >
            <span className="doc-scanner-capture-inner" />
          </button>
          {pageCount > 0 ? (
            <button
              type="button"
              className="doc-scanner-side-btn doc-scanner-end-btn"
              onClick={onReviewPages}
              aria-label="Finish scanning"
            >
              <span className="end-icon">✓</span>
              <span className="end-text">Done</span>
            </button>
          ) : (
            <button
              type="button"
              className="doc-scanner-side-btn"
              onClick={flipCamera}
              disabled={!!error}
              aria-label="Switch camera"
            >
              🔄
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
