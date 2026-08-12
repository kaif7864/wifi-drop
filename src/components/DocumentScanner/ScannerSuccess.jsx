/**
 * ScannerSuccess.jsx — Scan complete confirmation UI
 */

import { ScannerHeader, ScannerSteps } from './ScannerHeader';

export function ScannerSuccess({ pageCount, fileName, fileSize, onAddToTray, onScanMore }) {
  return (
    <div className="doc-scanner-shell">
      <ScannerHeader
        icon="✅"
        title="Scan Complete"
        subtitle="Ready to send to counter"
        onClose={onScanMore}
      />

      <div className="doc-scanner-success">
        <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={3} />

        <div className="doc-scanner-success-card">
          <div className="doc-scanner-success-icon">📕</div>
          <h2 className="doc-scanner-success-title">PDF Ready!</h2>
          <p className="doc-scanner-success-sub">
            {pageCount} page{pageCount !== 1 ? 's' : ''} merged — add to your send tray and hit upload
          </p>

          <div className="doc-scanner-success-file">
            <span className="doc-scanner-success-file-icon">📄</span>
            <div className="doc-scanner-success-file-info">
              <div className="doc-scanner-success-file-name">{fileName}</div>
              <div className="doc-scanner-success-file-meta">
                PDF · {pageCount} page{pageCount !== 1 ? 's' : ''} · {fileSize}
              </div>
            </div>
          </div>

          <div className="doc-scanner-success-actions">
            <button type="button" className="btn btn-primary" onClick={onAddToTray}>
              Add to Send Tray →
            </button>
            <button type="button" className="btn btn-ghost" onClick={onScanMore}>
              Scan More Pages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
