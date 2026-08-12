/**
 * ScannerHeader.jsx — Shared header matching WiFi Drop mobile style
 */

export function ScannerHeader({ icon = '📝', title, subtitle, onBack, onClose, backLabel = '✕' }) {
  return (
    <header className="doc-scanner-header">
      <div className="doc-scanner-header-left">
        <button
          type="button"
          className="btn-icon"
          onClick={onBack || onClose}
          aria-label={onBack ? 'Go back' : 'Close scanner'}
        >
          {onBack ? '←' : backLabel}
        </button>
        <div className="doc-scanner-header-icon">{icon}</div>
        <div className="doc-scanner-header-text">
          <div className="doc-scanner-header-title">{title}</div>
          {subtitle && <div className="doc-scanner-header-sub">{subtitle}</div>}
        </div>
      </div>
      {onClose && onBack && (
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
    </header>
  );
}

export function ScannerSteps({ steps, activeIndex }) {
  return (
    <div className="doc-scanner-steps" aria-hidden="true">
      {steps.map((_, i) => (
        <span key={i} className={`doc-scanner-step-dot ${i === activeIndex ? 'active' : ''}`} />
      ))}
    </div>
  );
}
