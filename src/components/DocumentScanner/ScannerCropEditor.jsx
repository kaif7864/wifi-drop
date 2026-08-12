/**
 * ScannerCropEditor.jsx — Crop corners + filter selection UI
 */

import { ScannerHeader, ScannerSteps } from './ScannerHeader';

const FILTERS = [
  { id: 'original', label: 'Original', previewClass: 'original' },
  { id: 'auto', label: 'Auto', previewClass: 'auto' },
  { id: 'bw', label: 'B & W', previewClass: 'bw' },
];

export function ScannerCropEditor({
  pageNumber,
  activeFilter,
  onFilterChange,
  onRetake,
  onAddPage,
  onDone,
}) {
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
        <div className="doc-scanner-crop-area">
          <div className="doc-scanner-crop-card">
            <div className="doc-scanner-camera-mock-lines" style={{ inset: '14%' }}>
              <div className="doc-scanner-mock-line long" />
              <div className="doc-scanner-mock-line medium" />
              <div className="doc-scanner-mock-line long" />
              <div className="doc-scanner-mock-line short" />
              <div className="doc-scanner-mock-line long" />
            </div>
            <div className="doc-scanner-crop-frame" />
            <span className="doc-scanner-crop-handle tl" role="presentation" />
            <span className="doc-scanner-crop-handle tr" role="presentation" />
            <span className="doc-scanner-crop-handle bl" role="presentation" />
            <span className="doc-scanner-crop-handle br" role="presentation" />
          </div>
        </div>

        <div className="doc-scanner-filter-section">
          <div className="doc-scanner-filter-label">Enhance</div>
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
          <button type="button" className="btn btn-ghost" onClick={onRetake}>
            Retake
          </button>
          <button type="button" className="btn btn-ghost" onClick={onAddPage}>
            + Page
          </button>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Done ✓
          </button>
        </div>
      </div>
    </div>
  );
}
