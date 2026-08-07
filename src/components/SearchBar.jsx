/**
 * client/src/components/SearchBar.jsx
 * Reusable Search Input Bar Component
 */

export function SearchBar({ value, onChange, placeholder = 'Search files, texts, devices…' }) {
  return (
    <div className="search-box">
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <style>{`
        .search-box {
          max-width: 260px;
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          background: #ffffff;
          color: var(--text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-xs);
          outline: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .search-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-glow);
          background: #ffffff;
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
