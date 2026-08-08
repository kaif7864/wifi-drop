/**
 * client/src/pages/dashboard/DashboardPage.jsx
 * Page 1: Dashboard Overview — Stats, Recent Files, Quick Actions, QR Generator
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

function StatCard({ icon, label, value, color = '#4F46E5', bg = '#EEF2FF', trend }) {
  return (
    <motion.div
      className="stat-card"
      style={{ '--stat-color': color, '--stat-bg': bg }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="stat-icon-wrapper" style={{ background: bg }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      </div>
      <div className="stat-body">
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
        {trend && (
          <div className="stat-trend" style={{ color: trend > 0 ? '#10B981' : '#EF4444' }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActivityBar({ day, pct }) {
  return (
    <div className="activity-bar-col">
      <div className="activity-bar-track">
        <div className="activity-bar-fill" style={{ height: `${pct}%` }} />
      </div>
      <span className="activity-bar-day">{day}</span>
    </div>
  );
}

export function DashboardPage({ files, texts, onNavChange, sessionId, shop }) {
  const [tempQrCust, setTempQrCust] = useState('');
  const [tempQrExpiry, setTempQrExpiry] = useState('1h');

  // Compute today's stats
  const today = new Date().toDateString();
  const todayFiles = useMemo(() => files.filter((f) => new Date(f.savedAt || f.createdAt).toDateString() === today), [files]);
  const pendingPrint = useMemo(() => files.filter((f) => !f.printedStatus), [files]);
  const uniqueCustomers = useMemo(() => new Set(files.map((f) => f.customerId || 'anon')).size, [files]);

  // Last 7 days activity (file count per day)
  const activityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    files.forEach((f) => {
      const d = new Date(f.savedAt || f.createdAt);
      const diff = Math.floor((now - d) / 86400000);
      if (diff >= 0 && diff < 7) counts[6 - diff]++;
    });
    const max = Math.max(...counts, 1);
    return counts.map((c, i) => ({
      day: days[(new Date(now - (6 - i) * 86400000)).getDay()],
      pct: Math.round((c / max) * 100),
      count: c,
    }));
  }, [files]);

  const recentItems = useMemo(() => {
    const f = files.map((x) => ({ ...x, _type: 'file', _time: new Date(x.savedAt || x.createdAt).getTime() }));
    const t = texts.map((x) => ({ ...x, _type: 'text', _time: new Date(x.receivedAt || x.createdAt).getTime() }));
    return [...f, ...t].sort((a, b) => b._time - a._time).slice(0, 6);
  }, [files, texts]);

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  return (
    <div className="dashboard-page">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <div>
          <h2 className="greeting-title">
            {shop ? `Welcome back, ${shop.shopName} 👋` : 'Good to see you! 👋'}
          </h2>
          <p className="greeting-sub">Here's what's happening at your shop today.</p>
        </div>
        <div className="greeting-date">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard icon="📁" label="Files Today" value={todayFiles.length} color="#4F46E5" bg="#EEF2FF" trend={12} />
        <StatCard icon="👥" label="Total Customers" value={uniqueCustomers} color="#0891B2" bg="#ECFEFF" trend={5} />
        <StatCard icon="⏳" label="Pending Prints" value={pendingPrint.length} color="#D97706" bg="#FFFBEB" />
        <StatCard icon="💬" label="Text Notes" value={texts.length} color="#7C3AED" bg="#F5F3FF" />
        <StatCard icon="📦" label="Total Files" value={files.length} color="#059669" bg="#ECFDF5" trend={8} />
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Activity Chart */}
        <div className="dash-card activity-card">
          <div className="dash-card-header">
            <h3 className="dash-card-title">📈 Activity — Last 7 Days</h3>
          </div>
          <div className="activity-chart">
            {activityData.map((d, i) => (
              <ActivityBar key={i} day={d.day} pct={d.pct} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3 className="dash-card-title">⚡ Quick Actions</h3>
          </div>
          <div className="quick-actions-grid">
            {[
              { icon: '📂', label: 'Customer Folders', nav: 'customer_folders', color: '#4F46E5', bg: '#EEF2FF' },
              { icon: '🖨️', label: 'Print Queue', nav: 'print', color: '#D97706', bg: '#FFFBEB' },
              { icon: '👥', label: 'Customers', nav: 'customers', color: '#0891B2', bg: '#ECFEFF' },
              { icon: '💳', label: 'Billing', nav: 'billing', color: '#059669', bg: '#ECFDF5' },
              { icon: '📊', label: 'Analytics', nav: 'analytics', color: '#7C3AED', bg: '#F5F3FF' },
              { icon: '📱', label: 'QR Manager', nav: 'qr_management', color: '#DB2777', bg: '#FDF2F8' },
            ].map((a) => (
              <button
                key={a.nav}
                className="quick-action-btn"
                style={{ '--qa-color': a.color, '--qa-bg': a.bg }}
                onClick={() => onNavChange(a.nav)}
              >
                <span className="qa-icon" style={{ background: a.bg, color: a.color }}>{a.icon}</span>
                <span className="qa-label">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dash-card recent-card">
          <div className="dash-card-header">
            <h3 className="dash-card-title">🕐 Recent Activity</h3>
            <button className="btn btn-ghost btn-xs" onClick={() => onNavChange('history')}>View All →</button>
          </div>
          {recentItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📭</span>
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No activity yet</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload QR scan karo aur files bhejo!</p>
            </div>
          ) : (
            <div className="recent-list">
              {recentItems.map((item, i) => (
                <div key={i} className="recent-item">
                  <div className="recent-item-icon">
                    {item._type === 'file' ? '📄' : '💬'}
                  </div>
                  <div className="recent-item-body">
                    <div className="recent-item-name">
                      {item._type === 'file' ? item.originalName : item.text?.slice(0, 40) + '...'}
                    </div>
                    <div className="recent-item-meta">
                      {item.customerName || item.deviceName || 'Anonymous'} · {timeAgo(item._type === 'file' ? item.savedAt : item.receivedAt)}
                    </div>
                  </div>
                  {item._type === 'file' && (
                    <span className={`status-pill ${item.printedStatus ? 'printed' : 'pending'}`}>
                      {item.printedStatus ? '✓ Printed' : '⏳ Pending'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Temp QR */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3 className="dash-card-title">📱 Create Temp QR</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Customer Name / Token</label>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Ramesh Kumar or Token #5"
                value={tempQrCust}
                onChange={(e) => setTempQrCust(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Expires In</label>
              <select className="input input-sm" value={tempQrExpiry} onChange={(e) => setTempQrExpiry(e.target.value)}>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="24h">24 Hours</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onNavChange('qr_management')}
            >
              🔴 Generate & Open QR Manager
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .dashboard-greeting {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.5rem 1.75rem;
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          border-radius: 20px;
          color: white;
        }

        .greeting-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: white;
          margin-bottom: 0.25rem;
        }

        .greeting-sub {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.8);
        }

        .greeting-date {
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(255,255,255,0.75);
          text-align: right;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.08);
          border-color: var(--stat-color);
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-value {
          font-size: 1.6rem;
          font-weight: 900;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.78rem;
          color: #64748B;
          font-weight: 600;
          margin-top: 2px;
        }

        .stat-trend {
          font-size: 0.7rem;
          font-weight: 700;
          margin-top: 4px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: auto auto;
          gap: 1rem;
        }

        .dash-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .dash-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .dash-card-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0F172A;
        }

        .activity-card {
          grid-column: 1;
          grid-row: 1;
        }

        .activity-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 120px;
        }

        .activity-bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          height: 100%;
        }

        .activity-bar-track {
          flex: 1;
          width: 100%;
          background: #F1F5F9;
          border-radius: 6px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }

        .activity-bar-fill {
          width: 100%;
          background: linear-gradient(to top, #4F46E5, #818CF8);
          border-radius: 6px;
          transition: height 0.5s ease;
          min-height: 4px;
        }

        .activity-bar-day {
          font-size: 10px;
          font-weight: 700;
          color: #94A3B8;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .quick-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 14px 8px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.18s ease;
          font-family: var(--font-family);
        }

        .quick-action-btn:hover {
          border-color: var(--qa-color);
          background: var(--qa-bg);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .qa-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }

        .qa-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #374151;
          text-align: center;
        }

        .recent-card {
          grid-column: 1;
          grid-row: 2;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 10px 12px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px solid #F1F5F9;
          transition: background 0.15s ease;
        }

        .recent-item:hover { background: #F1F5F9; }

        .recent-item-icon {
          font-size: 1.3rem;
          flex-shrink: 0;
        }

        .recent-item-body {
          flex: 1;
          min-width: 0;
        }

        .recent-item-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recent-item-meta {
          font-size: 0.72rem;
          color: #94A3B8;
          margin-top: 2px;
        }

        .status-pill {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .status-pill.printed {
          background: #ECFDF5;
          color: #059669;
        }

        .status-pill.pending {
          background: #FFFBEB;
          color: #D97706;
        }

        .form-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  );
}
