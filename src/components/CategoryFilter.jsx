/**
 * client/src/components/CategoryFilter.jsx
 * Category filter chips for filtering file types — Modern Light Theme Pill Buttons
 */

export function CategoryFilter({ currentFilter, onFilterChange }) {
  const filters = [
    { key: 'all', label: 'All Files' },
    { key: 'image', label: '🖼️ Images' },
    { key: 'doc', label: '📄 Documents' },
    { key: 'media', label: '🎬 Audio/Video' },
  ];

  return (
    <div className="filter-bar flex items-center gap-2">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`filter-chip ${currentFilter === key ? 'active' : ''}`}
          onClick={() => onFilterChange(key)}
        >
          {label}
        </button>
      ))}

      <style>{`
        .filter-bar {
          margin-bottom: var(--space-5);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
          width: 100%;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          background: #ffffff;
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          appearance: none;
          -webkit-appearance: none;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .filter-chip:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          background: var(--accent-light);
          transform: translateY(-1px);
        }

        .filter-chip.active {
          background: var(--accent-primary) !important;
          color: #ffffff !important;
          border-color: var(--accent-primary) !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
        }

        @media (max-width: 640px) {
          .filter-bar {
            margin-bottom: var(--space-3);
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            overflow: visible;
            padding-bottom: 0;
          }
          .filter-chip {
            padding: 6px 2px;
            font-size: 10.5px;
            font-weight: 700;
            width: 100%;
            justify-content: center;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
