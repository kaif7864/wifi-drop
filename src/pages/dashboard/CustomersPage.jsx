/**
 * client/src/pages/dashboard/CustomersPage.jsx
 * Page: Customer Management — Customer list, Nickname editor, activity history, and folder deletion
 * Connected to Backend Customer Nickname APIs
 */

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../../config';
import { ConfirmDeleteFolderModal } from '../../components/ConfirmDeleteFolderModal';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { QRModal } from '../../components/QRModal';
import { toast } from '../../context/ToastContext';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function CustomersPage({ files, texts, onNavChange, onDeleteFolder, shop }) {
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [qrCustomer, setQrCustomer] = useState(null);
  const [editingNick, setEditingNick] = useState(false);

  // Build customer groups
  const customers = useMemo(() => {
    const map = {};
    [...files, ...texts].forEach((item) => {
      const cid = item.customerId || 'cust_anonymous';
      if (!map[cid]) {
        map[cid] = {
          id: cid,
          name: item.customerName || item.deviceName || 'Anonymous',
          deviceName: item.deviceName || 'Unknown Device',
          files: [],
          texts: [],
          lastActivity: 0,
        };
      }
      if (item.customerName && item.customerName.trim()) {
        map[cid].name = item.customerName.trim();
      }
      const t = new Date(item.savedAt || item.receivedAt || item.createdAt).getTime();
      if (t > map[cid].lastActivity) map[cid].lastActivity = t;
      if (item.originalName) map[cid].files.push(item);
      else map[cid].texts.push(item);
    });
    return Object.values(map).sort((a, b) => b.lastActivity - a.lastActivity);
  }, [files, texts]);

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      c.deviceName.toLowerCase().includes(searchQ.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQ.toLowerCase())
    ), [customers, searchQ]);

  const selected = useMemo(() => customers.find((c) => c.id === selectedId), [customers, selectedId]);

  useEffect(() => {
    if (selected) {
      setNicknameInput(selected.name || '');
    }
  }, [selected]);

  const totalStorage = useMemo(() =>
    selected ? selected.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0
  , [selected]);

  async function handleSaveNickname() {
    if (!selected || !nicknameInput.trim()) return;
    setSavingNick(true);
    try {
      await axios.post(`${config.serverUrl}/api/customers/nickname`, {
        customerId: selected.id,
        nickname: nicknameInput.trim(),
        shopId: shop?.shopId || 'default',
      });
      // Update local objects immediately
      selected.files.forEach((f) => (f.customerName = nicknameInput.trim()));
      selected.texts.forEach((t) => (t.customerName = nicknameInput.trim()));
      selected.name = nicknameInput.trim();
      setEditingNick(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      toast.error('Error updating nickname: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingNick(false);
    }
  }

  async function handleConfirmPermanentDelete() {
    if (!deleteConfirmGroup) return;
    try {
      setIsDeletingFolder(true);
      if (onDeleteFolder) {
        await onDeleteFolder(deleteConfirmGroup.id);
        setSelectedId(null);
      }
      setDeleteConfirmGroup(null);
    } catch (e) {
      console.error('[Customer Delete Error]:', e);
    } finally {
      setIsDeletingFolder(false);
    }
  }

  return (
    <div className="customers-page">
      {/* Stats Bar */}
      <div className="customers-stats-bar">
        {[
          { icon: '👥', label: 'Total Customers', value: customers.length, color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
          { icon: '🟢', label: 'Active Today', value: customers.filter((c) => Date.now() - c.lastActivity < 86400000).length, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
          { icon: '📁', label: 'Total Files', value: files.length, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
          { icon: '💬', label: 'Text Notes', value: texts.length, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
        ].map((s) => (
          <div key={s.label} className="cust-stat-card">
            <div className="cust-stat-icon-wrap" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              <span style={{ fontSize: '1.35rem' }}>{s.icon}</span>
            </div>
            <div className="cust-stat-info">
              <div className="cust-stat-val" style={{ color: s.color }}>{s.value}</div>
              <div className="cust-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-Col Layout */}
      <div className="customers-layout">
        {/* Left: Customer List */}
        <div className="customers-list-panel">
          <div className="panel-header">
            <h3 className="panel-title">👥 All Customers</h3>
            <input
              type="text"
              className="input input-sm"
              placeholder="🔍 Search name/ID..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={{ width: '170px' }}
            />
          </div>

          <div className="customer-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">👥</span>
                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No customers found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  className={`customer-row ${selectedId === c.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                >
                  <div className="cust-avatar">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="cust-row-body">
                    <div className="cust-row-name">{c.name}</div>
                    <div className="cust-row-meta">{c.files.length} files · {timeAgo(c.lastActivity)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span className={`status-dot ${Date.now() - c.lastActivity < 3600000 ? 'active' : 'inactive'}`} />
                    {c.files.filter((f) => !f.printedStatus).length > 0 && (
                      <span className="pending-count">{c.files.filter((f) => !f.printedStatus).length} pending</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Customer Details & Nickname Editor */}
        <div className="customer-detail-panel">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Customer Header */}
                <div className="detail-header">
                  <div className="detail-avatar">{selected.name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="detail-name">{selected.name}</h3>
                        <button
                          className="btn btn-ghost btn-xs text-xs"
                          onClick={() => {
                            setEditingNick(!editingNick);
                            setNicknameInput(selected.name || '');
                          }}
                          title="Rename / Set Customer Nickname"
                        >
                          ✏️ Rename
                        </button>
                      </div>
                      <button className="btn btn-ghost btn-xs" style={{ color: '#EF4444' }} onClick={() => setDeleteConfirmGroup(selected)}>
                        🗑️ Delete Customer
                      </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{selected.deviceName}</p>
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                      ID: <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>{selected.id}</code>
                    </p>
                  </div>
                </div>

                {/* Nickname Editor Box (Only shown when editing requested) */}
                {editingNick && (
                  <div className="nickname-box">
                    <label className="form-label">🏷️ Custom Folder Name / Nickname</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input input-sm flex-1"
                        placeholder="e.g. Ramesh Bhai / Token #4"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleSaveNickname} disabled={savingNick}>
                        {savingNick ? 'Saving...' : '💾 Save'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingNick(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {savedSuccess && (
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, margin: '6px 0', display: 'block' }}>
                    ✅ Nickname updated persistently across all files!
                  </span>
                )}

                {/* Detail Stats */}
                <div className="detail-stats-row mt-4">
                  {[
                    { icon: '📁', label: 'Total Files', value: selected.files.length, color: '#4F46E5' },
                    { icon: '⏳', label: 'Pending Print', value: selected.files.filter((f) => !f.printedStatus).length, color: '#D97706' },
                    { icon: '💾', label: 'Storage Used', value: formatBytes(totalStorage), color: '#059669' },
                    { icon: '💬', label: 'Text Notes', value: selected.texts.length, color: '#7C3AED' },
                  ].map((s) => (
                    <div key={s.label} className="detail-stat">
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span>{s.icon}</span> {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Files */}
                <div className="detail-section">
                  <h4 className="detail-section-title">📄 Recent Files ({selected.files.length})</h4>
                  {selected.files.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No files received yet.</p>
                  ) : (
                    <div className="detail-file-list">
                      {selected.files.slice(0, 5).map((f, i) => (
                        <div key={i} className="detail-file-row">
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                            {f.mimeType?.startsWith('image/') ? '🖼️' : f.mimeType?.includes('pdf') ? '📕' : '📄'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.originalName}>
                              {f.originalName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{formatBytes(f.size)} · {timeAgo(f.savedAt)}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`status-pill ${f.printedStatus ? 'printed' : 'pending'}`}>
                              {f.printedStatus ? '✓ Printed' : '⏳ Pending'}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs detail-preview-btn"
                              title="Preview file"
                              onClick={() => setPreviewFile(f)}
                            >
                              👁️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="detail-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setQrCustomer(selected)}
                    title="Generate direct upload QR for this customer folder"
                  >
                    📱 Generate Folder QR
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onNavChange('customer_folders', selected.id || selected.name)}>
                    📂 Open Customer Folder
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onNavChange('billing')}>
                    💳 Create Invoice
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="detail-empty">
                <span style={{ fontSize: '3rem' }}>👈</span>
                <p style={{ fontWeight: 700, color: '#64748B', marginTop: '0.75rem' }}>Select a customer</p>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Click on a customer to view their files and edit nickname.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Permanent Delete Confirmation Modal with Never Restore Warning */}
      {deleteConfirmGroup && (
        <ConfirmDeleteFolderModal
          group={deleteConfirmGroup}
          onConfirm={handleConfirmPermanentDelete}
          onCancel={() => setDeleteConfirmGroup(null)}
          isDeleting={isDeletingFolder}
        />
      )}

      {/* In-App File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Direct Customer Folder Upload QR Modal */}
      {qrCustomer && (
        <QRModal
          isOpen={Boolean(qrCustomer)}
          onClose={() => setQrCustomer(null)}
          customerId={qrCustomer.id}
          customerName={qrCustomer.name}
          deviceName={qrCustomer.deviceName}
          shopId={shop?.shopId || 'default'}
          shopName={shop?.shopName || 'WiFi Drop'}
        />
      )}

      <style>{`
        .customers-page { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
        .customers-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .cust-stat-card { background: white; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 14px; }
        .cust-stat-icon-wrap { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cust-stat-info { display: flex; flex-direction: column; min-width: 0; }
        .cust-stat-val { font-size: 1.65rem; font-weight: 900; line-height: 1.1; }
        .cust-stat-lbl { font-size: 0.78rem; color: #64748B; font-weight: 600; margin-top: 2px; }
        .customers-layout { display: grid; grid-template-columns: 340px 1fr; gap: 1rem; min-height: 500px; }
        .customers-list-panel, .customer-detail-panel { background: white; border: 1px solid #E2E8F0; border-radius: 18px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #F1F5F9; }
        .panel-title { font-size: 0.92rem; font-weight: 800; }
        .customer-list { overflow-y: auto; max-height: 520px; }
        .customer-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: none; background: transparent; cursor: pointer; border-bottom: 1px solid #F8FAFC; transition: background 0.15s ease; font-family: var(--font-family); text-align: left; }
        .customer-row:hover { background: #F8FAFC; }
        .customer-row.selected { background: #EEF2FF; border-left: 3px solid #4F46E5; }
        .cust-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; font-weight: 800; font-size: 1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cust-row-body { flex: 1; min-width: 0; }
        .cust-row-name { font-size: 0.84rem; font-weight: 700; color: #0F172A; }
        .cust-row-meta { font-size: 0.72rem; color: #94A3B8; margin-top: 2px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .status-dot.active { background: #10B981; }
        .status-dot.inactive { background: #CBD5E1; }
        .pending-count { font-size: 0.65rem; font-weight: 800; color: #D97706; background: #FFFBEB; padding: 1px 5px; border-radius: 4px; }
        .customer-detail-panel { padding: 1.5rem; display: flex; flex-direction: column; }
        .detail-header { display: flex; align-items: flex-start; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #F1F5F9; margin-bottom: 1rem; }
        .detail-avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; font-weight: 900; font-size: 1.4rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .detail-name { font-size: 1.1rem; font-weight: 900; color: #0F172A; }
        .nickname-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; margin-bottom: 1rem; }
        .detail-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
        .detail-stat { background: #F8FAFC; border-radius: 10px; padding: 12px; text-align: center; border: 1px solid #F1F5F9; }
        .detail-section { margin-bottom: 1.25rem; }
        .detail-section-title { font-size: 0.88rem; font-weight: 800; color: #374151; margin-bottom: 0.75rem; }
        .detail-file-list { display: flex; flex-direction: column; gap: 6px; }
        .detail-file-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #F8FAFC; border-radius: 10px; border: 1px solid #F1F5F9; }
        .status-pill { font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; flex-shrink: 0; }
        .status-pill.printed { background: #ECFDF5; color: #059669; }
        .status-pill.pending { background: #FFFBEB; color: #D97706; }
        .detail-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid #F1F5F9; margin-top: auto; }
        .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
        .mt-4 { margin-top: 1rem; }

        /* ── Mobile Responsive Breakpoints ── */
        @media (max-width: 1024px) {
          .customers-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }

          .customers-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .customers-page {
            gap: 1rem;
          }

          .customers-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }

          .cust-stat-card {
            padding: 0.875rem 1rem;
            border-radius: 12px;
          }

          .cust-stat-val {
            font-size: 1.4rem;
          }

          .detail-stats-row {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .customer-detail-panel {
            padding: 1rem;
            border-radius: 14px;
          }

          .detail-actions {
            flex-direction: column;
          }

          .detail-actions .btn {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .customers-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .cust-stat-card {
            padding: 0.75rem;
          }

          .cust-stat-val {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </div>
  );
}
