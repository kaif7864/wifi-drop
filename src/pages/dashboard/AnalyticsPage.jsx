/**
 * client/src/pages/dashboard/AnalyticsPage.jsx
 * Page: Reports & Analytics — Key Metrics, Charts, Insights
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

function MetricCard({ icon, label, value, sub, trend, color = '#4F46E5', bg = '#EEF2FF' }) {
  return (
    <div className="metric-card" style={{ '--mc': color, '--mb': bg }}>
      <div className="metric-icon" style={{ background: bg }}>{icon}</div>
      <div className="metric-body">
        <div className="metric-value" style={{ color }}>{value}</div>
        <div className="metric-label">{label}</div>
        {sub && <div className="metric-sub">{sub}</div>}
        {trend !== undefined && (
          <div className="metric-trend" style={{ color: trend >= 0 ? '#10B981' : '#EF4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
          </div>
        )}
      </div>
    </div>
  );
}

function BarChart({ data, color = '#4F46E5' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-col">
          <div className="bar-track">
            <motion.div
              className="bar-fill"
              style={{ background: color }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
              transition={{ duration: 0.6, delay: i * 0.06 }}
            />
          </div>
          <span className="bar-label">{d.label}</span>
          <span className="bar-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage({ files, texts }) {
  const now = Date.now();

  // Last 7 days bar data
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const label = d.toLocaleDateString('en', { weekday: 'short' });
      const value = files.filter((f) => new Date(f.savedAt || f.createdAt).toDateString() === d.toDateString()).length;
      days.push({ label, value });
    }
    return days;
  }, [files]);

  // Last 4 weeks bar data
  const last4Weeks = useMemo(() => {
    return [3, 2, 1, 0].map((i) => {
      const start = now - (i + 1) * 7 * 86400000;
      const end = now - i * 7 * 86400000;
      return {
        label: `W${4 - i}`,
        value: files.filter((f) => {
          const t = new Date(f.savedAt || f.createdAt).getTime();
          return t >= start && t < end;
        }).length,
      };
    });
  }, [files]);

  // File type breakdown
  const fileTypes = useMemo(() => {
    const map = {};
    files.forEach((f) => {
      const type = f.mimeType?.startsWith('image/') ? 'Images'
        : f.mimeType?.includes('pdf') ? 'PDF'
        : f.mimeType?.startsWith('video/') ? 'Video'
        : f.mimeType?.startsWith('audio/') ? 'Audio'
        : 'Other';
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [files]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = {};
    files.forEach((f) => {
      const name = f.customerName || f.deviceName || 'Anonymous';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [files]);

  const todayFiles = files.filter((f) => new Date(f.savedAt || f.createdAt).toDateString() === new Date().toDateString()).length;
  const printedPct = files.length > 0 ? Math.round((files.filter((f) => f.printedStatus).length / files.length) * 100) : 0;
  const uniqueCustomers = new Set(files.map((f) => f.customerId || 'anon')).size;

  return (
    <div className="analytics-page">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard icon="📁" label="Total Files" value={files.length} sub={`${todayFiles} today`} trend={12} color="#4F46E5" bg="#EEF2FF" />
        <MetricCard icon="👥" label="Customers" value={uniqueCustomers} trend={8} color="#0891B2" bg="#ECFEFF" />
        <MetricCard icon="🖨️" label="Print Rate" value={`${printedPct}%`} sub="Files printed" trend={5} color="#059669" bg="#ECFDF5" />
        <MetricCard icon="💬" label="Text Notes" value={texts.length} color="#7C3AED" bg="#F5F3FF" />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Daily Activity */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">📈 Daily Activity — Last 7 Days</h3>
          </div>
          <BarChart data={last7Days} color="#4F46E5" />
        </div>

        {/* Weekly Activity */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">📊 Weekly Trend</h3>
          </div>
          <BarChart data={last4Weeks} color="#7C3AED" />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="analytics-bottom">
        {/* File Type Breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">📋 File Types</h3>
          </div>
          {fileTypes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No files yet</p>
          ) : (
            <div className="type-breakdown">
              {fileTypes.map(([type, count]) => {
                const pct = Math.round((count / files.length) * 100);
                const color = type === 'Images' ? '#D97706' : type === 'PDF' ? '#EF4444' : type === 'Video' ? '#7C3AED' : '#059669';
                return (
                  <div key={type} className="type-row">
                    <span className="type-name">{type}</span>
                    <div className="type-bar-track">
                      <motion.div
                        className="type-bar-fill"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="type-count">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">🏆 Top Customers</h3>
          </div>
          {topCustomers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No customers yet</p>
          ) : (
            <div className="top-cust-list">
              {topCustomers.map(([name, count], i) => (
                <div key={name} className="top-cust-row">
                  <div className="top-cust-rank" style={{
                    background: i === 0 ? '#FFFBEB' : i === 1 ? '#F8FAFC' : '#F8FAFC',
                    color: i === 0 ? '#D97706' : '#94A3B8',
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div className="top-cust-name">{name}</div>
                  <div className="top-cust-bar">
                    <motion.div
                      className="top-cust-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / topCustomers[0][1]) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    />
                  </div>
                  <span className="top-cust-count">{count} files</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="chart-card insights-card">
          <div className="chart-header">
            <h3 className="chart-title">💡 Insights</h3>
          </div>
          <div className="insights-list">
            {[
              files.length > 10 && `🚀 You've received ${files.length} files total — great traction!`,
              printedPct === 100 && `✅ All files printed — excellent print management!`,
              printedPct < 50 && files.length > 0 && `⚠️ ${100 - printedPct}% files still pending print. Clear the queue!`,
              uniqueCustomers > 3 && `👥 ${uniqueCustomers} unique customers have used your shop.`,
              todayFiles > 5 && `📈 ${todayFiles} files received today — busy day!`,
              texts.length > 0 && `💬 ${texts.length} text notes shared via mobile.`,
              !files.length && `📭 No files yet. Share your QR code with customers to start!`,
            ].filter(Boolean).slice(0, 4).map((insight, i) => (
              <div key={i} className="insight-item">{insight}</div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .analytics-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .metric-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 1.1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }

        .metric-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          font-size: 1.4rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .metric-value { font-size: 1.5rem; font-weight: 900; line-height: 1; }
        .metric-label { font-size: 0.78rem; font-weight: 600; color: #64748B; margin-top: 3px; }
        .metric-sub { font-size: 0.7rem; color: #94A3B8; }
        .metric-trend { font-size: 0.7rem; font-weight: 700; margin-top: 2px; }

        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .analytics-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }

        .chart-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .chart-header { margin-bottom: 1rem; }
        .chart-title { font-size: 0.92rem; font-weight: 800; color: #0F172A; }

        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 130px;
        }

        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
        }

        .bar-track {
          flex: 1;
          width: 100%;
          background: #F1F5F9;
          border-radius: 6px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }

        .bar-fill {
          width: 100%;
          border-radius: 6px;
          min-height: 4px;
        }

        .bar-label { font-size: 10px; font-weight: 700; color: #94A3B8; }
        .bar-val { font-size: 10px; font-weight: 800; color: #64748B; }

        .type-breakdown { display: flex; flex-direction: column; gap: 10px; }

        .type-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .type-name { font-size: 0.8rem; font-weight: 700; width: 60px; flex-shrink: 0; }

        .type-bar-track {
          flex: 1;
          height: 8px;
          background: #F1F5F9;
          border-radius: 999px;
          overflow: hidden;
        }

        .type-bar-fill { height: 100%; border-radius: 999px; }

        .type-count { font-size: 0.75rem; font-weight: 700; color: #64748B; width: 70px; text-align: right; flex-shrink: 0; }

        .top-cust-list { display: flex; flex-direction: column; gap: 10px; }

        .top-cust-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .top-cust-rank {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .top-cust-name { font-size: 0.82rem; font-weight: 700; flex-shrink: 0; min-width: 80px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .top-cust-bar {
          flex: 1;
          height: 8px;
          background: #F1F5F9;
          border-radius: 999px;
          overflow: hidden;
        }

        .top-cust-bar-fill {
          height: 100%;
          background: linear-gradient(to right, #4F46E5, #818CF8);
          border-radius: 999px;
        }

        .top-cust-count { font-size: 0.72rem; font-weight: 700; color: #64748B; flex-shrink: 0; }

        .insights-list { display: flex; flex-direction: column; gap: 10px; }

        .insight-item {
          font-size: 0.82rem;
          font-weight: 600;
          color: #374151;
          padding: 10px 14px;
          background: #F8FAFC;
          border-radius: 10px;
          border: 1px solid #F1F5F9;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
