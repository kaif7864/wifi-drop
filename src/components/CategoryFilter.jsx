/**
 * client/src/components/CategoryFilter.jsx
 * Category filter chips for filtering file types
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
          className={`filter-chip ${currentFilter === key ? 'active' : ''}`}
          onClick={() => onFilterChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
