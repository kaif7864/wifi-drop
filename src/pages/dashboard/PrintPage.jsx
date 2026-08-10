/**
 * client/src/pages/dashboard/PrintPage.jsx
 * Page: Print Management — Print Queue, History, Printer Settings
 * Connected to Backend APIs for Bulk Marking & Printer Preferences
 */

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../../config';
import { toast } from '../../context/ToastContext';

import { isFileInBill, toggleFileInBill } from '../../utils/billManager';
import { FilePreviewModal } from '../../components/FilePreviewModal';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PrintPage({ files, onTogglePrint, shop }) {
  const [activeTab, setActiveTab] = useState('queue');
  const [searchQ, setSearchQ] = useState('');
  const [previewFile, setPreviewFile] = useState(null);

  // Printer settings state
  const [defaultPrinter, setDefaultPrinter] = useState('HP LaserJet Pro M404n');
  const [paperSize, setPaperSize] = useState('A4 (210 × 297 mm)');
  const [printQuality, setPrintQuality] = useState('High (Best)');
  const [colorMode, setColorMode] = useState('Auto (Detect)');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const shopId = shop?.shopId || 'default';

  useEffect(() => {
    fetchSettings();
  }, [shopId]);

  async function fetchSettings() {
    try {
      const res = await axios.get(`${config.serverUrl}/api/settings?shopId=${shopId}`);
      if (res.data.success && res.data.settings) {
        const s = res.data.settings;
        if (s.defaultPrinter) setDefaultPrinter(s.defaultPrinter);
        if (s.paperSize) setPaperSize(s.paperSize);
        if (s.colorMode) setColorMode(s.colorMode);
      }
    } catch {}
  }

  const queue = useMemo(() => files.filter((f) => !f.printedStatus), [files]);
  const printed = useMemo(() => files.filter((f) => f.printedStatus), [files]);

  const filteredQueue = useMemo(() =>
    queue.filter((f) =>
      f.originalName?.toLowerCase().includes(searchQ.toLowerCase()) ||
      (f.customerName || f.deviceName || '').toLowerCase().includes(searchQ.toLowerCase())
    ), [queue, searchQ]);

  const filteredPrinted = useMemo(() =>
    printed.filter((f) =>
      f.originalName?.toLowerCase().includes(searchQ.toLowerCase()) ||
      (f.customerName || f.deviceName || '').toLowerCase().includes(searchQ.toLowerCase())
    ), [printed, searchQ]);

  function getMimeIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📄';
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  async function handleMarkAllPrinted() {
    queue.forEach((f) => onTogglePrint && onTogglePrint(f));
    try {
      await axios.post(`${config.serverUrl}/api/files/mark-printed-bulk`, { shopId });
    } catch (err) {
      console.warn('[Bulk Mark Printed Warning]:', err.message);
    }
  }

  async function handleSaveSettings() {
    try {
      await axios.put(`${config.serverUrl}/api/settings`, {
        shopId,
        defaultPrinter,
        paperSize,
        colorMode,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      toast.error('Failed to save printer settings');
    }
  }

  return (
    <div className="print-page">
      {/* Summary Stats */}
      <div className="print-stats-bar">
        <div className="print-stat">
          <span className="print-stat-val" style={{ color: '#D97706' }}>{queue.length}</span>
          <span className="print-stat-lbl">⏳ Pending</span>
        </div>
        <div className="print-stat">
          <span className="print-stat-val" style={{ color: '#059669' }}>{printed.length}</span>
          <span className="print-stat-lbl">✅ Printed</span>
        </div>
        <div className="print-stat">
          <span className="print-stat-val" style={{ color: '#4F46E5' }}>{files.length}</span>
          <span className="print-stat-lbl">📁 Total Files</span>
        </div>
        <div className="print-stat">
          <span className="print-stat-val" style={{ color: '#7C3AED' }}>
            {files.length > 0 ? Math.round((printed.length / files.length) * 100) : 0}%
          </span>
          <span className="print-stat-lbl">📊 Completion</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="print-toolbar">
        <div className="tab-pills">
          <button className={`tab-pill ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
            ⏳ Print Queue ({queue.length})
          </button>
          <button className={`tab-pill ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            ✅ Printed ({printed.length})
          </button>
          <button className={`tab-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </button>
        </div>

        <div className="print-toolbar-right">
          <input
            type="text"
            className="input input-sm"
            placeholder="🔍 Search files..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{ width: '220px' }}
          />
          {activeTab === 'queue' && queue.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={handleMarkAllPrinted}>
              ✓ Mark All Printed
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'queue' && (
          <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredQueue.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🎉</span>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No pending prints!</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>All files have been printed.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View (>768px) */}
                <div className="print-table-wrapper print-desktop-only">
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>File</th>
                        <th>Customer</th>
                        <th>Size</th>
                        <th>Received</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((file, i) => (
                        <tr key={file.uuid || file.id || i}>
                          <td className="row-num">{i + 1}</td>
                          <td>
                            <div className="file-cell">
                              <span className="file-type-icon">{getMimeIcon(file.mimeType)}</span>
                              <div>
                                <div className="file-name">{file.originalName}</div>
                                <div className="file-type-badge">{file.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="cust-cell">
                              <div className="cust-name">{file.customerName || 'Anonymous'}</div>
                              <div className="cust-device">{file.deviceName}</div>
                            </div>
                          </td>
                          <td><span className="size-tag">{formatBytes(file.size)}</span></td>
                          <td><span className="time-tag">{timeAgo(file.savedAt || file.createdAt)}</span></td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="btn btn-ghost btn-xs"
                                title="Preview file in modal"
                                onClick={() => setPreviewFile(file)}
                              >
                                👁️ View
                              </button>
                              <button
                                className={`btn btn-xs ${isFileInBill(file.uuid || file.id || file._id) ? 'btn-success' : 'btn-secondary'}`}
                                title="Toggle Customer Bill Queue"
                                onClick={() => toggleFileInBill(file)}
                              >
                                {isFileInBill(file.uuid || file.id || file._id) ? '✓ Billed' : '💳 Bill'}
                              </button>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => onTogglePrint && onTogglePrint(file)}
                              >
                                🖨️ Mark Printed
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View (<=768px) */}
                <div className="print-mobile-list">
                  {filteredQueue.map((file, i) => {
                    const isBilled = isFileInBill(file.uuid || file.id || file._id);
                    return (
                      <div key={file.uuid || file.id || i} className="print-mobile-card">
                        <div className="pm-card-top">
                          <div className="pm-file-info">
                            <span className="pm-icon">{getMimeIcon(file.mimeType)}</span>
                            <div className="pm-details">
                              <p className="pm-name" title={file.originalName}>{file.originalName}</p>
                              <p className="pm-meta">
                                <span>{formatBytes(file.size)}</span>
                                {file.pageCount && file.pageCount > 1 && (
                                  <span className="pm-pages"> · 📄 {file.pageCount} Pages</span>
                                )}
                                <span> · {timeAgo(file.savedAt || file.createdAt)}</span>
                              </p>
                              <p className="pm-customer">
                                👤 {file.customerName || 'Customer'} {file.deviceName ? `(${file.deviceName})` : ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pm-card-bottom">
                          <div className="pm-left-btns">
                            <button className="btn-icon-sm" onClick={() => setPreviewFile(file)} title="View">
                              👁️
                            </button>
                            <button
                              className={`btn-pill-sm ${isBilled ? 'billed' : ''}`}
                              onClick={() => toggleFileInBill(file)}
                            >
                              {isBilled ? '✓ Billed' : '💳 Bill'}
                            </button>
                          </div>
                          <button
                            className="btn btn-primary btn-sm pm-print-btn"
                            onClick={() => onTogglePrint && onTogglePrint(file)}
                          >
                            🖨️ Mark Printed
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredPrinted.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📋</span>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No printed files yet</p>
              </div>
            ) : (
              <>
                {/* Desktop History Table */}
                <div className="print-table-wrapper print-desktop-only">
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>File</th>
                        <th>Customer</th>
                        <th>Size</th>
                        <th>Printed</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrinted.map((file, i) => (
                        <tr key={file.uuid || file.id || i} style={{ opacity: 0.85 }}>
                          <td className="row-num">{i + 1}</td>
                          <td>
                            <div className="file-cell">
                              <span className="file-type-icon">{getMimeIcon(file.mimeType)}</span>
                              <div className="file-name">{file.originalName}</div>
                            </div>
                          </td>
                          <td><div className="cust-name">{file.customerName || 'Anonymous'}</div></td>
                          <td><span className="size-tag">{formatBytes(file.size)}</span></td>
                          <td><span className="badge badge-success" style={{ fontSize: '11px' }}>✓ Printed</span></td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="btn btn-ghost btn-xs"
                                title="Preview file in modal"
                                onClick={() => setPreviewFile(file)}
                              >
                                👁️ View
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => onTogglePrint && onTogglePrint(file)}
                              >
                                ↩ Unmark
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile History Card List */}
                <div className="print-mobile-list">
                  {filteredPrinted.map((file, i) => (
                    <div key={file.uuid || file.id || i} className="print-mobile-card printed-card">
                      <div className="pm-card-top">
                        <div className="pm-file-info">
                          <span className="pm-icon">{getMimeIcon(file.mimeType)}</span>
                          <div className="pm-details">
                            <p className="pm-name" title={file.originalName}>{file.originalName}</p>
                            <p className="pm-meta">
                              <span>{formatBytes(file.size)}</span>
                              <span> · 👤 {file.customerName || 'Customer'}</span>
                            </p>
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Printed</span>
                      </div>

                      <div className="pm-card-bottom">
                        <button className="btn-icon-sm" onClick={() => setPreviewFile(file)} title="View">
                          👁️ View
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => onTogglePrint && onTogglePrint(file)}
                        >
                          ↩ Unmark
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="printer-settings-card">
              <h4 style={{ marginBottom: '1rem', fontWeight: 800 }}>🖨️ Printer Configuration</h4>
              <div className="settings-grid">
                <div className="setting-row">
                  <label className="form-label">Default Printer</label>
                  <select className="input input-sm" value={defaultPrinter} onChange={(e) => setDefaultPrinter(e.target.value)}>
                    <option>HP LaserJet Pro M404n</option>
                    <option>Canon PIXMA G4010</option>
                    <option>Epson EcoTank L3150</option>
                    <option>Brother DCP-L2531DW</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label className="form-label">Paper Size</label>
                  <select className="input input-sm" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                    <option>A4 (210 × 297 mm)</option>
                    <option>A3 (297 × 420 mm)</option>
                    <option>Letter (216 × 279 mm)</option>
                    <option>Legal (216 × 356 mm)</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label className="form-label">Print Quality</label>
                  <select className="input input-sm" value={printQuality} onChange={(e) => setPrintQuality(e.target.value)}>
                    <option>High (Best)</option>
                    <option>Medium (Standard)</option>
                    <option>Draft (Fast)</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label className="form-label">Color Mode</label>
                  <select className="input input-sm" value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
                    <option>Auto (Detect)</option>
                    <option>Color</option>
                    <option>Black & White</option>
                    <option>Grayscale</option>
                  </select>
                </div>
              </div>
              <div className="printer-status-row">
                <span className="dot dot-success" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Printer Connected & Ready</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button className="btn btn-primary btn-sm" onClick={handleSaveSettings}>💾 Save Settings</button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🧪 Test Print</button>
                {saveSuccess && (
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>✅ Printer settings saved!</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <style>{`
        .print-page { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
        .print-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .print-stat { background: white; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .print-stat-val { font-size: 1.8rem; font-weight: 900; line-height: 1; }
        .print-stat-lbl { font-size: 0.78rem; color: #64748B; font-weight: 600; }
        .print-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .tab-pills { display: flex; gap: 6px; background: #F1F5F9; padding: 4px; border-radius: 9999px; }
        .tab-pill { padding: 8px 18px; border-radius: 9999px; border: none; background: transparent; font-size: 0.84rem; font-weight: 600; color: #64748B; cursor: pointer; transition: all 0.18s ease; font-family: var(--font-family); white-space: nowrap; }
        .tab-pill.active { background: white; color: #4F46E5; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .print-toolbar-right { display: flex; align-items: center; gap: 0.75rem; }
        .print-table-wrapper { background: white; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th { background: #F8FAFC; padding: 12px 16px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0; }
        .print-table td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .print-table tr:last-child td { border-bottom: none; }
        .print-table tr:hover td { background: #F8FAFC; }
        .row-num { font-size: 0.8rem; font-weight: 800; color: #94A3B8; width: 40px; }
        .file-cell { display: flex; align-items: center; gap: 10px; }
        .file-type-icon { font-size: 1.4rem; }
        .file-name { font-size: 0.84rem; font-weight: 700; color: #0F172A; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-type-badge { font-size: 0.65rem; font-weight: 700; color: #64748B; background: #F1F5F9; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; }
        .cust-name { font-size: 0.84rem; font-weight: 700; color: #0F172A; }
        .cust-device { font-size: 0.72rem; color: #94A3B8; }
        .size-tag, .time-tag { font-size: 0.78rem; color: #64748B; font-weight: 600; }
        .action-btns { display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; }
        .printer-settings-card { background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
        .setting-row { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 0.8rem; font-weight: 700; color: #374151; }
        .mt-4 { margin-top: 1rem; }

        .print-mobile-list { display: none; }
        .print-desktop-only { display: block; }

        /* ── Mobile Responsive Breakpoints ── */
        @media (max-width: 1024px) {
          .print-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .print-desktop-only { display: none !important; }
          .print-mobile-list { display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box; }

          .print-mobile-card {
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 14px;
            padding: 12px 14px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
          }

          .print-mobile-card.printed-card {
            background: #F8FAFC;
            border-left: 4px solid #10B981;
          }

          .pm-card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
          }

          .pm-file-info {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            flex: 1;
            min-width: 0;
          }

          .pm-icon {
            font-size: 1.5rem;
            flex-shrink: 0;
          }

          .pm-details {
            flex: 1;
            min-width: 0;
          }

          .pm-name {
            font-size: 0.86rem;
            font-weight: 700;
            color: #0F172A;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
          }

          .pm-meta {
            font-size: 0.72rem;
            color: #64748B;
            font-weight: 600;
            margin-bottom: 2px;
          }

          .pm-pages {
            color: var(--accent-primary);
            font-weight: 700;
          }

          .pm-customer {
            font-size: 0.72rem;
            color: #475569;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .pm-card-bottom {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            padding-top: 8px;
            border-top: 1px solid #F1F5F9;
          }

          .pm-left-btns {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .btn-icon-sm {
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 6px;
            border: 1px solid #E2E8F0;
            background: #F8FAFC;
            color: #334155;
            cursor: pointer;
          }

          .btn-pill-sm {
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 700;
            border-radius: 999px;
            border: 1px solid #C7D2FE;
            background: #EEF2FF;
            color: #4F46E5;
            cursor: pointer;
          }

          .btn-pill-sm.billed {
            background: #ECFDF5;
            color: #059669;
            border-color: rgba(16, 185, 129, 0.3);
          }

          .pm-print-btn {
            padding: 6px 12px !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            white-space: nowrap;
          }

          .print-page {
            gap: 1rem;
          }

          .print-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }

          .print-stat {
            padding: 0.875rem 1rem;
            border-radius: 12px;
          }

          .print-stat-val {
            font-size: 1.4rem;
          }

          .print-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .tab-pills {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            width: 100%;
            padding: 3px;
            gap: 2px;
            overflow: visible;
          }

          .tab-pill {
            padding: 6px 2px;
            font-size: 10.5px;
            font-weight: 700;
            text-align: center;
            justify-content: center;
          }

          .print-toolbar-right {
            width: 100%;
            justify-content: space-between;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .print-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .print-stat {
            padding: 0.75rem;
          }

          .print-stat-val {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </div>
  );
}
