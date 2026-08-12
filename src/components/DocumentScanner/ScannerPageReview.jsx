/**
 * ScannerPageReview.jsx — Multi-page thumbnail review before PDF export
 */

import { ScannerHeader, ScannerSteps } from './ScannerHeader';

export function ScannerPageReview({
  pages,
  activePageIndex,
  onSelectPage,
  onDeletePage,
  onAddPage,
  onBack,
  onCreatePdf,
  isExporting,
}) {
  const activePage = pages[activePageIndex];

  return (
    <div className="doc-scanner-shell doc-scanner-review-wrap">
      <ScannerHeader
        icon="📄"
        title="Review Scan"
        subtitle={<> {pages.length} page{pages.length !== 1 ? 's' : ''} ready to merge</>}
        onBack={onBack}
      />
      <ScannerSteps steps={[1, 2, 3, 4]} activeIndex={2} />

      <div className="doc-scanner-review-main">
        <div className="doc-scanner-review-preview-wrap">
          {activePage?.dataUrl ? (
            <img
              src={activePage.dataUrl}
              alt={`Page ${activePageIndex + 1}`}
              className="doc-scanner-review-preview-img"
            />
          ) : (
            <div className="doc-scanner-review-preview">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="doc-scanner-review-preview-line" />
              ))}
            </div>
          )}
          <p className="doc-scanner-review-page-label">
            Page <span>{activePageIndex + 1}</span> of {pages.length}
            {activePage?.filter && activePage.filter !== 'original' && (
              <> · {activePage.filter === 'bw' ? 'B & W' : 'Auto'}</>
            )}
          </p>
        </div>
      </div>

      <div className="doc-scanner-thumbnail-section">
        <div className="doc-scanner-thumbnail-label">All pages</div>
        <div className="doc-scanner-thumbnail-strip">
          {pages.map((page, i) => (
            <div
              key={page.id}
              className={`doc-scanner-thumbnail ${i === activePageIndex ? 'active' : ''}`}
              onClick={() => onSelectPage(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectPage(i)}
            >
              {page.thumbnailUrl ? (
                <img src={page.thumbnailUrl} alt={`Page ${i + 1}`} className="doc-scanner-thumb-img" />
              ) : (
                i + 1
              )}
              {pages.length > 1 && (
                <button
                  type="button"
                  className="doc-scanner-thumbnail-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(i);
                  }}
                  aria-label={`Delete page ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="doc-scanner-thumbnail-add" onClick={onAddPage} aria-label="Add page">
            +
          </button>
        </div>
      </div>

      <div className="doc-scanner-review-actions">
        <button type="button" className="btn btn-ghost" onClick={onAddPage} disabled={isExporting}>
          + Add Page
        </button>
        <button type="button" className="btn btn-primary" onClick={onCreatePdf} disabled={isExporting}>
          {isExporting ? 'Creating...' : `Create PDF (${pages.length} pg)`}
        </button>
      </div>
    </div>
  );
}
