/**
 * ScannerExporting.jsx — PDF creation loading state UI
 */

import { ScannerSteps } from './ScannerHeader';

export function ScannerExporting({ progress = 72 }) {
  return (
    <div className="doc-scanner-shell">
      <div className="doc-scanner-exporting">
        <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={3} />
        <div className="doc-scanner-exporting-card">
          <div className="doc-scanner-spinner" />
          <h2 className="doc-scanner-exporting-text">Creating PDF...</h2>
          <p className="doc-scanner-exporting-sub">
            Merging your scanned pages into one print-ready document
          </p>
          <div className="doc-scanner-progress-bar">
            <div className="doc-scanner-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="doc-scanner-progress-badge">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
