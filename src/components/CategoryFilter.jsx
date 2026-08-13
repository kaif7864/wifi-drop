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
    { key: 'other', label: '📦 Other / Zip' },
  ];

  return (
    <div className="filter-bar">
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
          margin-bottom: var(--space-4);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 8px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--border);
          background: #ffffff;
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          appearance: none;
          -webkit-appearance: none;
          white-space: nowrap;
          width: 100%;
          text-align: center;
          box-sizing: border-box;
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

        @media (max-width: 768px) {
          .filter-bar {
            gap: 4px;
            margin-bottom: var(--space-3);
          }
          .filter-chip {
            padding: 7px 2px;
            font-size: 10px;
            gap: 3px;
          }
        }
      `}</style>
    </div>
  );
}
