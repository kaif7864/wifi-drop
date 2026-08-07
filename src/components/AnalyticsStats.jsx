/**
 * client/src/components/AnalyticsStats.jsx
 * Analytics statistics cards & storage metrics widget
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AnalyticsStats({ filesCount, textsCount, totalStorageSize, sessionId }) {
  const stats = [
    { icon: '📂', value: filesCount, label: 'Total Files Received' },
    { icon: '💬', value: textsCount, label: 'Total Text Notes' },
    { icon: '💾', value: formatBytes(totalStorageSize), label: 'Total Size Transferred' },
    { icon: '🔑', value: sessionId, label: 'Current Session Code' },
  ];

  return (
    <div className="analytics-grid">
      {stats.map((stat, idx) => (
        <div key={idx} className="stat-card glass-card">
          <span className="stat-icon">{stat.icon}</span>
          <div>
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-label">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
