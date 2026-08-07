/**
 * client/src/components/SearchBar.jsx
 * Reusable Search Input Bar
 */

export function SearchBar({ value, onChange, placeholder = 'Search files, texts, devices…' }) {
  return (
    <div className="search-box">
      <input
        type="text"
        className="input search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
