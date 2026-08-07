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
    { icon: '📂', value: filesCount, label: 'Total Files Received', color: '#4F46E5' },
    { icon: '💬', value: textsCount, label: 'Total Text Notes', color: '#0EA5E9' },
    { icon: '💾', value: formatBytes(totalStorageSize), label: 'Total Size Transferred', color: '#10B981' },
    { icon: '🔑', value: sessionId, label: 'Current Session Code', color: '#F59E0B' },
  ];

  return (
    <div className="analytics-grid">
      {stats.map((stat, idx) => (
        <div key={idx} className="stat-card glass-card">
          <div className="stat-icon-badge" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
            {stat.icon}
          </div>
          <div>
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-label">{stat.label}</p>
          </div>
        </div>
      ))}

      <style>{`
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: var(--space-5);
        }
        .stat-card {
          padding: var(--space-6);
          display: flex;
          align-items: center;
          gap: var(--space-5);
          background: #ffffff;
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          border: 1px solid var(--border);
        }
        .stat-icon-badge {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .stat-value {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          color: var(--text-primary);
        }
        .stat-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
