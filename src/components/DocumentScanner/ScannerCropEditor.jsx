/**
 * ScannerCropEditor.jsx — Interactive crop + instant filter preview
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { ScannerHeader, ScannerSteps } from './ScannerHeader';
import {
  getImageLayout,
  imageToDisplay,
  displayToImage,
  clampCorners,
} from '../../utils/documentScan/perspectiveTransform';
import { processScanPreview } from '../../utils/documentScan/processScanPage';
import { detectDocumentCornersLite } from '../../utils/documentScan/edgeDetectionLite';

const FILTERS = [
  { id: 'original', label: 'Original', previewClass: 'original' },
  { id: 'auto', label: 'Auto', previewClass: 'auto' },
  { id: 'bw', label: 'B & W', previewClass: 'bw' },
];

const HANDLE_KEYS = ['tl', 'tr', 'br', 'bl'];

/** Edge midpoints move both corners on that side together */
const EDGE_HANDLES = [
  { id: 'top', keys: ['tl', 'tr'] },
  { id: 'right', keys: ['tr', 'br'] },
  { id: 'bottom', keys: ['br', 'bl'] },
  { id: 'left', keys: ['bl', 'tl'] },
];

function cloneCorners(corners) {
  return {
    tl: { ...corners.tl },
    tr: { ...corners.tr },
    br: { ...corners.br },
    bl: { ...corners.bl },
  };
}

export function ScannerCropEditor({
  pageNumber,
  isEditing = false,
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
  const [viewMode, setViewMode] = useState('crop');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [detectingEdges, setDetectingEdges] = useState(false);
  const [detectMessage, setDetectMessage] = useState(null);
  const [dragging, setDragging] = useState(null);
  const cornerTimerRef = useRef(null);
  const dragRef = useRef(null);

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

  const runPreview = useCallback(
    (filter, showImmediately = true, maxEdge = 720) => {
      if (!sourceCanvas || !corners) return;
      try {
        if (showImmediately) setPreviewLoading(true);
        const result = processScanPreview(sourceCanvas, corners, filter, maxEdge);
        setPreviewUrl(result.dataUrl);
        if (showImmediately) {
          setViewMode('preview');
          setPreviewLoading(false);
        }
      } catch {
        setPreviewUrl(null);
        setPreviewLoading(false);
      }
    },
    [sourceCanvas, corners]
  );

  // Initial preview on mount
  useEffect(() => {
    runPreview(activeFilter, false);
  }, [sourceCanvas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced preview when corners move in crop mode (400px while dragging for speed)
  useEffect(() => {
    if (!sourceCanvas || !corners || viewMode !== 'crop') return;

    const maxEdge = dragging ? 400 : 720;

    if (cornerTimerRef.current) clearTimeout(cornerTimerRef.current);
    cornerTimerRef.current = setTimeout(() => {
      runPreview(activeFilter, false, maxEdge);
    }, dragging ? 80 : 180);

    return () => {
      if (cornerTimerRef.current) clearTimeout(cornerTimerRef.current);
    };
  }, [corners, sourceCanvas, activeFilter, viewMode, runPreview, dragging]);

  const handleFilterClick = (filterId) => {
    onFilterChange(filterId);
    runPreview(filterId, true);
  };

  const handleAutoDetect = () => {
    if (!sourceCanvas || detectingEdges) return;
    setDetectingEdges(true);
    setDetectMessage(null);
    setViewMode('crop');

    // Run off main stack so spinner paints first
    setTimeout(() => {
      try {
        const result = detectDocumentCornersLite(sourceCanvas, imageWidth, imageHeight);
        if (result) {
          onCornersChange(result);
          setDetectMessage(null);
        } else {
          setDetectMessage('Edges not found — drag corners manually');
        }
      } catch {
        setDetectMessage('Detection failed — drag corners manually');
      } finally {
        setDetectingEdges(false);
      }
    }, 16);
  };

  const getPointerImagePoint = useCallback(
    (e) => {
      const el = containerRef.current;
      if (!el || !layout) return null;
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return displayToImage(
        { x: clientX - rect.left, y: clientY - rect.top },
        layout
      );
    },
    [layout]
  );

  const handleCornerPointerDown = (key, e) => {
    e.preventDefault();
    setViewMode('crop');
    dragRef.current = { type: 'corner', key };
    setDragging(`corner-${key}`);
  };

  const handleEdgePointerDown = (edgeId, keys, e) => {
    e.preventDefault();
    setViewMode('crop');
    const startPt = getPointerImagePoint(e);
    if (!startPt || !corners) return;
    dragRef.current = {
      type: 'edge',
      edgeId,
      keys,
      startPt,
      startCorners: cloneCorners(corners),
    };
    setDragging(`edge-${edgeId}`);
  };

  useEffect(() => {
    if (!dragging || !layout) return;

    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag || !corners) return;

      const pt = getPointerImagePoint(e);
      if (!pt) return;

      if (drag.type === 'corner') {
        onCornersChange(clampCorners({ ...corners, [drag.key]: pt }, imageWidth, imageHeight));
        return;
      }

      if (drag.type === 'edge') {
        const dx = pt.x - drag.startPt.x;
        const dy = pt.y - drag.startPt.y;
        const next = cloneCorners(drag.startCorners);
        for (const key of drag.keys) {
          next[key] = {
            x: drag.startCorners[key].x + dx,
            y: drag.startCorners[key].y + dy,
          };
        }
        onCornersChange(clampCorners(next, imageWidth, imageHeight));
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(null);
    };

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
  }, [dragging, layout, corners, imageWidth, imageHeight, onCornersChange, getPointerImagePoint]);

  const getHandleStyle = (key) => {
    if (!layout || !corners?.[key]) return {};
    const pos = imageToDisplay(corners[key], layout);
    return { left: `${pos.x}px`, top: `${pos.y}px` };
  };

  const getEdgeMidpointStyle = (keyA, keyB) => {
    if (!layout || !corners?.[keyA] || !corners?.[keyB]) return {};
    const mid = {
      x: (corners[keyA].x + corners[keyB].x) / 2,
      y: (corners[keyA].y + corners[keyB].y) / 2,
    };
    const pos = imageToDisplay(mid, layout);
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
        title={isEditing ? `Edit Page ${pageNumber}` : `Adjust Page ${pageNumber}`}
        subtitle={<>Drag corners or edge midpoints · Tap filter to preview</>}
        onBack={onRetake}
      />
      <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={1} />

      <div className="doc-scanner-crop-mode-tabs">
        <button
          type="button"
          className={`doc-scanner-mode-tab ${viewMode === 'crop' ? 'active' : ''}`}
          onClick={() => setViewMode('crop')}
        >
          ✂️ Crop
        </button>
        <button
          type="button"
          className={`doc-scanner-mode-tab ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => {
            runPreview(activeFilter, true);
          }}
          disabled={!previewUrl && previewLoading}
        >
          👁 Preview
        </button>
      </div>

      <div className="doc-scanner-crop-wrap">
        <div className="doc-scanner-crop-area" ref={containerRef}>
          {viewMode === 'preview' ? (
            <div className="doc-scanner-filter-preview-full">
              {previewLoading && !previewUrl ? (
                <div className="doc-scanner-preview-loading">
                  <div className="doc-scanner-spinner" />
                  <span>Applying filter...</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Filter preview"
                  className="doc-scanner-filter-preview-img"
                />
              ) : null}
              <span className="doc-scanner-filter-preview-label badge badge-accent">
                {FILTERS.find((f) => f.id === activeFilter)?.label || 'Preview'}
              </span>
            </div>
          ) : (
            <>
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
                  className="doc-scanner-crop-handle doc-scanner-crop-handle-corner"
                  style={getHandleStyle(key)}
                  onPointerDown={(e) => handleCornerPointerDown(key, e)}
                  role="presentation"
                />
              ))}
              {EDGE_HANDLES.map(({ id, keys }) => (
                <span
                  key={id}
                  className="doc-scanner-crop-handle doc-scanner-crop-handle-edge"
                  style={getEdgeMidpointStyle(keys[0], keys[1])}
                  onPointerDown={(e) => handleEdgePointerDown(id, keys, e)}
                  role="presentation"
                  title={`Move ${id} edge`}
                />
              ))}
            </>
          )}
        </div>

        <div className="doc-scanner-filter-section">
          <div className="doc-scanner-filter-label">Enhance — tap to preview</div>
          <div className="doc-scanner-filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`doc-scanner-filter-pill ${activeFilter === f.id ? 'active' : ''}`}
                onClick={() => handleFilterClick(f.id)}
              >
                <span className={`doc-scanner-filter-preview ${f.previewClass}`} />
                {f.label}
              </button>
            ))}
          </div>
          <div className="doc-scanner-tools-row">
            <button
              type="button"
              className="doc-scanner-autodetect-btn"
              onClick={handleAutoDetect}
              disabled={detectingEdges || isProcessing}
            >
              {detectingEdges ? 'Detecting…' : '✨ Auto-detect'}
            </button>
          </div>
          {detectMessage && (
            <p className="doc-scanner-detect-msg">{detectMessage}</p>
          )}
        </div>

        <div className="doc-scanner-crop-actions">
          <button type="button" className="btn btn-ghost" onClick={onRetake} disabled={isProcessing}>
            Retake
          </button>
          <button type="button" className="btn btn-ghost" onClick={onAddPage} disabled={isProcessing || isEditing}>
            + Add Page
          </button>
          <button type="button" className="btn btn-primary" onClick={onDone} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : isEditing ? 'Save ✓' : 'Done ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
