/**
 * ScannerCamera.jsx — Live camera (lightweight, gallery fallback)
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ScannerHeader, ScannerSteps } from './ScannerHeader';
import { useScannerCamera } from '../../hooks/useScannerCamera';
import { captureVideoFrame } from '../../utils/documentScan/processScanPage';
import { getVideoCoverLayout } from '../../utils/documentScan/edgeDetection';
import { defaultCorners } from '../../utils/documentScan/perspectiveTransform';

function canUseCameraApi() {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function ScannerCamera({
  isActive,
  pageCount,
  onCapture,
  onImportImage,
  onReviewPages,
  onClose,
}) {
  const galleryRef = useRef(null);
  const viewfinderRef = useRef(null);
  const capturingRef = useRef(false);
  const [autoFlash, setAutoFlash] = useState(false);

  const cameraAllowed = useMemo(() => canUseCameraApi(), []);

  const {
    videoRef,
    ready,
    error,
    flipCamera,
    retry,
    torchOn,
    torchAvailable,
    toggleTorch,
  } = useScannerCamera(isActive && cameraAllowed);

  const blockedMessage = !cameraAllowed
    ? 'Camera needs HTTPS — use gallery 🖼️ below to scan'
    : null;

  const displayError = blockedMessage || error;

  const [overlayLayout, setOverlayLayout] = useState(null);

  const updateOverlayLayout = useCallback(() => {
    const container = viewfinderRef.current;
    const video = typeof videoRef === 'function' ? null : videoRef?.current;
    // videoRef is callback ref — read from DOM in viewfinder
    const videoEl = viewfinderRef.current?.querySelector('video');
    if (!container || !videoEl?.videoWidth) return;
    const rect = container.getBoundingClientRect();
    setOverlayLayout(
      getVideoCoverLayout(rect.width, rect.height, videoEl.videoWidth, videoEl.videoHeight)
    );
  }, [videoRef]);

  useEffect(() => {
    if (!ready) return;
    updateOverlayLayout();
    window.addEventListener('resize', updateOverlayLayout);
    return () => window.removeEventListener('resize', updateOverlayLayout);
  }, [ready, updateOverlayLayout]);

  const performCapture = useCallback(() => {
    const videoEl = viewfinderRef.current?.querySelector('video');
    if (!videoEl || !ready || capturingRef.current) return;
    capturingRef.current = true;

    try {
      const frame = captureVideoFrame(videoEl);
      onCapture({
        dataUrl: frame.dataUrl,
        width: frame.width,
        height: frame.height,
        canvas: frame.canvas,
        detectedCorners: defaultCorners(frame.width, frame.height),
      });
      setAutoFlash(true);
      setTimeout(() => setAutoFlash(false), 350);
    } catch (err) {
      console.warn('[ScannerCamera] Capture failed:', err.message);
    } finally {
      setTimeout(() => {
        capturingRef.current = false;
      }, 600);
    }
  }, [ready, onCapture]);

  const handleGalleryChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportImage(file);
    e.target.value = '';
  };

  const showLoading = cameraAllowed && !displayError && !ready;

  return (
    <div className="doc-scanner-shell">
      <ScannerHeader
        icon="📝"
        title="Scan Document"
        subtitle={<>Align page in frame · <strong>Multi-page PDF</strong></>}
        onClose={onClose}
      />
      <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={0} />

      <div className="doc-scanner-camera-wrap">
        <div className={`doc-scanner-viewfinder ${autoFlash ? 'doc-scanner-flash' : ''}`} ref={viewfinderRef}>
          {displayError ? (
            <div className="doc-scanner-camera-error">
              <span className="doc-scanner-camera-error-icon">📷</span>
              <p>{displayError}</p>
              {cameraAllowed && (
                <button type="button" className="btn btn-primary btn-sm" onClick={retry}>
                  Try Again
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm doc-scanner-gallery-fallback-btn"
                onClick={() => galleryRef.current?.click()}
              >
                🖼️ Import from Gallery
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
                onLoadedMetadata={updateOverlayLayout}
              />
              {showLoading && (
                <div className="doc-scanner-camera-loading">
                  <div className="doc-scanner-spinner" />
                  <span>Starting camera...</span>
                </div>
              )}

              {ready && overlayLayout && (
                <svg className="doc-scanner-camera-overlay" aria-hidden="true">
                  <rect
                    x={overlayLayout.offsetX + overlayLayout.drawW * 0.1}
                    y={overlayLayout.offsetY + overlayLayout.drawH * 0.12}
                    width={overlayLayout.drawW * 0.8}
                    height={overlayLayout.drawH * 0.76}
                    className="doc-scanner-camera-polygon doc-scanner-camera-polygon-guide"
                    rx={4}
                  />
                </svg>
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
          {displayError
            ? 'Tap 🖼️ gallery to scan without camera'
            : showLoading
            ? 'Starting camera (max 12s)...'
            : ready
            ? 'Tap capture — adjust crop on next screen'
            : 'Point camera at document'}
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
            onClick={performCapture}
            disabled={!ready || !!displayError}
            aria-label="Capture page"
          >
            <span className="doc-scanner-capture-inner" />
          </button>
          {torchAvailable ? (
            <button
              type="button"
              className={`doc-scanner-side-btn ${torchOn ? 'doc-scanner-torch-on' : ''}`}
              onClick={toggleTorch}
              aria-label="Toggle flash"
            >
              ⚡
            </button>
          ) : pageCount > 0 ? (
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
              disabled={!!displayError || !cameraAllowed}
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
