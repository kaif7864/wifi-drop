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
  const autoTimerRef = useRef(null);

  const [autoFlash, setAutoFlash] = useState(false);
  const [scanMode, setScanMode] = useState('manual'); // 'manual' | 'auto'
  const [docDetected, setDocDetected] = useState(true);
  const [autoCountdown, setAutoCountdown] = useState(null);

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
    const videoEl = viewfinderRef.current?.querySelector('video');
    if (!container || !videoEl?.videoWidth) return;
    const rect = container.getBoundingClientRect();
    setOverlayLayout(
      getVideoCoverLayout(rect.width, rect.height, videoEl.videoWidth, videoEl.videoHeight)
    );
  }, []);

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
    setAutoCountdown(null);

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

  // Auto-capture timer when in 'auto' mode and document is ready
  useEffect(() => {
    if (scanMode !== 'auto' || !ready || displayError || capturingRef.current) {
      setAutoCountdown(null);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      return;
    }

    setAutoCountdown(2);
    const intervalId = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev === 1) {
          clearInterval(intervalId);
          performCapture();
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [scanMode, ready, displayError, performCapture]);

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
          {ready && !displayError && (
            <div className={`doc-scanner-status-badge ${docDetected ? 'detected' : 'searching'}`}>
              <span className="badge-dot" />
              {docDetected ? 'DOCUMENT DETECTED' : 'SEARCHING DOCUMENT...'}
            </div>
          )}

          {autoCountdown && (
            <div className="doc-scanner-auto-countdown">
              <span>Hold Steady</span>
              <div className="countdown-number">{autoCountdown}</div>
            </div>
          )}

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
                    x={overlayLayout.offsetX + overlayLayout.drawW * 0.08}
                    y={overlayLayout.offsetY + overlayLayout.drawH * 0.1}
                    width={overlayLayout.drawW * 0.84}
                    height={overlayLayout.drawH * 0.8}
                    className="doc-scanner-camera-polygon doc-scanner-camera-polygon-guide"
                    rx={6}
                  />
                  <circle cx={overlayLayout.offsetX + overlayLayout.drawW * 0.08} cy={overlayLayout.offsetY + overlayLayout.drawH * 0.1} r="6" className="camera-corner-dot" />
                  <circle cx={overlayLayout.offsetX + overlayLayout.drawW * 0.92} cy={overlayLayout.offsetY + overlayLayout.drawH * 0.1} r="6" className="camera-corner-dot" />
                  <circle cx={overlayLayout.offsetX + overlayLayout.drawW * 0.92} cy={overlayLayout.offsetY + overlayLayout.drawH * 0.9} r="6" className="camera-corner-dot" />
                  <circle cx={overlayLayout.offsetX + overlayLayout.drawW * 0.08} cy={overlayLayout.offsetY + overlayLayout.drawH * 0.9} r="6" className="camera-corner-dot" />
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
            ? scanMode === 'auto'
              ? 'Hold steady for auto-capture...'
              : 'Tap capture — adjust crop on next screen'
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
        <div className="doc-scanner-mode-switch">
          <button
            type="button"
            className={`doc-scanner-mode-tab ${scanMode === 'manual' ? 'active' : ''}`}
            onClick={() => setScanMode('manual')}
          >
            📸 Manual
          </button>
          <button
            type="button"
            className={`doc-scanner-mode-tab ${scanMode === 'auto' ? 'active' : ''}`}
            onClick={() => setScanMode('auto')}
          >
            ⚡ Auto
          </button>
        </div>

        <div className="doc-scanner-camera-controls">
          <button
            type="button"
            className="doc-scanner-side-btn"
            aria-label="Import from gallery"
            onClick={() => galleryRef.current?.click()}
            title="Import from gallery"
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
              title="Toggle flash"
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
              title="Switch camera"
            >
              🔄
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
