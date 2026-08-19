import { useState } from 'react';
import { ScannerHeader, ScannerSteps } from './ScannerHeader';

export function ScannerSuccess({ pageCount, fileName, fileSize, exportFormat = 'pdf', onChangeFormat, onAddToTray, onScanMore }) {
  const [selectedFormat, setSelectedFormat] = useState(exportFormat);

  const handleFormatSelect = (fmt) => {
    setSelectedFormat(fmt);
    onChangeFormat?.(fmt);
  };

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
          <div className="doc-scanner-success-icon">
            {selectedFormat === 'jpg' ? '🖼️' : '📕'}
          </div>
          <h2 className="doc-scanner-success-title">
            {selectedFormat === 'jpg' ? 'JPG Ready!' : 'PDF Ready!'}
          </h2>
          <p className="doc-scanner-success-sub">
            {pageCount} page{pageCount !== 1 ? 's' : ''} processed — select output format and add to send tray
          </p>

          <div className="doc-scanner-format-selector">
            <button
              type="button"
              className={`doc-scanner-format-pill ${selectedFormat === 'pdf' ? 'active' : ''}`}
              onClick={() => handleFormatSelect('pdf')}
            >
              📄 PDF
            </button>
            <button
              type="button"
              className={`doc-scanner-format-pill ${selectedFormat === 'jpg' ? 'active' : ''}`}
              onClick={() => handleFormatSelect('jpg')}
            >
              🖼️ JPG
            </button>
          </div>

          <div className="doc-scanner-success-file">
            <span className="doc-scanner-success-file-icon">
              {selectedFormat === 'jpg' ? '🖼️' : '📄'}
            </span>
            <div className="doc-scanner-success-file-info">
              <div className="doc-scanner-success-file-name">{fileName}</div>
              <div className="doc-scanner-success-file-meta">
                {selectedFormat.toUpperCase()} · {pageCount} page{pageCount !== 1 ? 's' : ''} · {fileSize}
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
