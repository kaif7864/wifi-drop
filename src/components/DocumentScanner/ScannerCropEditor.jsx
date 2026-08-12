/**
 * ScannerCropEditor.jsx — Interactive crop corners + live filter preview
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { ScannerHeader, ScannerSteps } from './ScannerHeader';
import {
  getImageLayout,
  imageToDisplay,
  displayToImage,
  clampCorners,
} from '../../utils/documentScan/perspectiveTransform';
import { processScanPage } from '../../utils/documentScan/processScanPage';

const FILTERS = [
  { id: 'original', label: 'Original', previewClass: 'original' },
  { id: 'auto', label: 'Auto', previewClass: 'auto' },
  { id: 'bw', label: 'B & W', previewClass: 'bw' },
];

const HANDLE_KEYS = ['tl', 'tr', 'br', 'bl'];

export function ScannerCropEditor({
  pageNumber,
  sourceDataUrl,
  sourceCanvas,
  imageWidth,
  imageHeight,
  corners,
  onCornersChange,
  activeFilter,
  onFilterChange,
  onRetake,
  onAddPage,
  onDone,
  isProcessing,
}) {
  const containerRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragging, setDragging] = useState(null);

  const updateLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el || !imageWidth || !imageHeight) return;
    const rect = el.getBoundingClientRect();
    setLayout(getImageLayout(rect.width, rect.height, imageWidth, imageHeight));
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [updateLayout, sourceDataUrl]);

  // Live preview when corners or filter change
  useEffect(() => {
    if (!sourceCanvas || !corners) return;

    const timer = setTimeout(() => {
      try {
        const result = processScanPage(sourceCanvas, corners, activeFilter);
        setPreviewUrl(result.thumbnailUrl);
      } catch {
        setPreviewUrl(null);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [sourceCanvas, corners, activeFilter]);

  const handlePointerDown = (key, e) => {
    e.preventDefault();
    setDragging(key);
  };

  useEffect(() => {
    if (!dragging || !layout) return;

    const onMove = (e) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const pt = displayToImage(
        { x: clientX - rect.left, y: clientY - rect.top },
        layout
      );
      const next = clampCorners(
        { ...corners, [dragging]: pt },
        imageWidth,
        imageHeight
      );
      onCornersChange(next);
    };

    const onUp = () => setDragging(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, layout, corners, imageWidth, imageHeight, onCornersChange]);

  const getHandleStyle = (key) => {
    if (!layout || !corners?.[key]) return {};
    const pos = imageToDisplay(corners[key], layout);
    return { left: `${pos.x}px`, top: `${pos.y}px` };
  };

  const getPolygonPoints = () => {
    if (!layout || !corners) return '';
    return HANDLE_KEYS.map((k) => {
      const p = imageToDisplay(corners[k], layout);
      return `${p.x},${p.y}`;
    }).join(' ');
  };

  return (
    <div className="doc-scanner-shell">
      <ScannerHeader
        icon="✂️"
        title={`Adjust Page ${pageNumber}`}
        subtitle={<>Drag corners · Pick a filter</>}
        onBack={onRetake}
      />
      <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={1} />

      <div className="doc-scanner-crop-wrap">
        <div className="doc-scanner-crop-area" ref={containerRef}>
          <img
            src={sourceDataUrl}
            alt="Captured page"
            className="doc-scanner-crop-source-img"
            draggable={false}
          />
          {layout && corners && (
            <svg className="doc-scanner-crop-svg" aria-hidden="true">
              <polygon points={getPolygonPoints()} className="doc-scanner-crop-polygon" />
            </svg>
          )}
          {HANDLE_KEYS.map((key) => (
            <span
              key={key}
              className="doc-scanner-crop-handle"
              style={getHandleStyle(key)}
              onPointerDown={(e) => handlePointerDown(key, e)}
              role="presentation"
            />
          ))}
        </div>

        <div className="doc-scanner-filter-section">
          <div className="flex items-center justify-between mb-2">
            <span className="doc-scanner-filter-label" style={{ marginBottom: 0 }}>Enhance</span>
            {previewUrl && (
              <div className="doc-scanner-filter-preview-tag">
                <img src={previewUrl} alt="Preview" />
                <span>Live Preview</span>
              </div>
            )}
          </div>
          <div className="doc-scanner-filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`doc-scanner-filter-pill ${activeFilter === f.id ? 'active' : ''}`}
                onClick={() => onFilterChange(f.id)}
              >
                <span className={`doc-scanner-filter-preview ${f.previewClass}`} />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="doc-scanner-crop-actions">
          <button type="button" className="btn btn-ghost" onClick={onRetake} disabled={isProcessing}>
            Retake
          </button>
          <button type="button" className="btn btn-ghost" onClick={onAddPage} disabled={isProcessing}>
            + Page
          </button>
          <button type="button" className="btn btn-primary" onClick={onDone} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Done ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
