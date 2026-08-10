/**
 * client/src/pages/dashboard/QRManagementPage.jsx
 * Page: QR Management — 4 QR Types (Permanent, Temp Upload, View-Only with Expiry, Folder-Specific)
 * Connected to Temp QR Backend REST APIs & DB Persistence
 */

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { QRModal } from '../../components/QRModal';
import { config } from '../../config';

const EXPIRY_OPTIONS = [
  { label: '30 Minutes', value: '30m', ms: 30 * 60000 },
  { label: '1 Hour', value: '1h', ms: 3600000 },
  { label: '4 Hours', value: '4h', ms: 4 * 3600000 },
  { label: '1 Day', value: '24h', ms: 86400000 },
  { label: '3 Days', value: '72h', ms: 3 * 86400000 },
];

function QRTypeCard({ icon, title, desc, badge, children, color = '#4F46E5' }) {
  return (
    <div className="qr-type-card" style={{ '--qc': color }}>
      <div className="qr-type-header">
        <div className="qr-type-icon-wrap" style={{ background: `${color}18` }}>
          <span style={{ fontSize: '1.6rem' }}>{icon}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="qr-type-title">{title}</h3>
            <span className="qr-badge" style={{ background: `${color}20`, color }}>{badge}</span>
          </div>
          <p className="qr-type-desc">{desc}</p>
        </div>
      </div>
      <div className="qr-type-body">{children}</div>
    </div>
  );
}

function CustomFolderSelect({ folders = [], value, onChange, placeholder = '-- Choose Customer Folder --', allowCustom = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const selected = folders.find((f) => f.id === value || f.name === value) || (value ? { id: value, name: value, count: 0 } : null);

  const filteredFolders = folders.filter((f) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase().trim();
    return (f.name || '').toLowerCase().includes(q) || (f.id || '').toLowerCase().includes(q);
  });

  const hasExactMatch = folders.some((f) => (f.name || '').toLowerCase() === searchQ.trim().toLowerCase());

  return (
    <div className="custom-select-wrap">
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQ('');
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontSize: '1.1rem' }}>{selected ? '📁' : '📂'}</span>
          <span className={`custom-select-label ${!selected ? 'placeholder' : ''}`}>
            {selected ? selected.name : placeholder}
          </span>
          {selected && selected.count > 0 && (
            <span className="custom-select-count-badge">
              {selected.count} {selected.count === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
        <span className={`custom-select-chevron ${isOpen ? 'open' : ''}`}>▾</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="custom-select-backdrop" onClick={() => setIsOpen(false)} />
            <motion.div
              className="custom-select-dropdown"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {/* Search Field */}
              <div className="custom-select-search-wrap">
                <input
                  type="text"
                  className="custom-select-search-input"
                  placeholder="🔍 Search customer or token..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQ && (
                  <button
                    type="button"
                    className="custom-select-clear-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQ('');
                    }}
                  >
                    ✖
                  </button>
                )}
              </div>

              <div className="custom-select-options-list">
                {/* None option */}
                {!searchQ && (
                  <div
                    className={`custom-select-option ${!value ? 'selected' : ''}`}
                    onClick={() => {
                      onChange('');
                      setIsOpen(false);
                    }}
                  >
                    <span style={{ opacity: 0.7 }}>🚫 None / All Folders</span>
                  </div>
                )}

                {/* Custom Token Selection */}
                {allowCustom && searchQ.trim() && !hasExactMatch && (
                  <div
                    className="custom-select-option custom-add-option"
                    onClick={() => {
                      onChange(searchQ.trim());
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="folder-opt-icon">✨</span>
                      <span>Use: <strong>"{searchQ.trim()}"</strong></span>
                    </div>
                    <span className="folder-opt-badge new">Custom</span>
                  </div>
                )}

                {/* Filtered Folder Options */}
                {filteredFolders.map((c) => (
                  <div
                    key={c.id}
                    className={`custom-select-option ${(value === c.id || value === c.name) ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(c.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="folder-opt-icon">📁</span>
                      <span className="folder-opt-name">{c.name}</span>
                    </div>
                    <span className="folder-opt-badge">{c.count} files</span>
                  </div>
                ))}

                {filteredFolders.length === 0 && !searchQ.trim() && (
                  <div className="custom-select-empty">No customer folders yet</div>
                )}

                {filteredFolders.length === 0 && searchQ.trim() && !allowCustom && (
                  <div className="custom-select-empty">No matching customers found</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function QRManagementPage({ sessionId, shop, files = [] }) {
  const [permQrOpen, setPermQrOpen] = useState(false);

  // Temp Upload QR state
  const [tempCustName, setTempCustName] = useState('');
  const [tempExpiry, setTempExpiry] = useState('1h');
  const [tempQrs, setTempQrs] = useState([]);
  const [, setLoadingQrs] = useState(false);
  const [tempQrOpen, setTempQrOpen] = useState(false);
  const [tempSessionId, setTempSessionId] = useState('');

  // View-Only Temp QR state (with Expiry)
  const [viewCustFolderId, setViewCustFolderId] = useState('');
  const [viewCustCustomName, setViewCustCustomName] = useState('');
  const [viewExpiry, setViewExpiry] = useState('4h');
  const [viewQrOpen, setViewQrOpen] = useState(false);
  const [activeViewQrData, setActiveViewQrData] = useState(null);

  // Folder QR state
  const [folderCustId, setFolderCustId] = useState('');
  const [folderQrOpen, setFolderQrOpen] = useState(false);

  const shopId = shop?.shopId || 'default';

  // Load temp QRs on mount
  useEffect(() => {
    fetchTempQrs();
  }, [shopId]);

  async function fetchTempQrs() {
    setLoadingQrs(true);
    try {
      const res = await axios.get(`${config.serverUrl}/api/qr/temp?shopId=${shopId}`);
      if (res.data.success) {
        setTempQrs(res.data.qrs || []);
      }
    } catch {
      // Ignore fallback
    } finally {
      setLoadingQrs(false);
    }
  }

  // Get unique customer folders from files
  const customerFolders = (() => {
    const map = {};
    (files || []).forEach((f) => {
      const cid = f?.customerId || 'cust_anonymous';
      if (!map[cid]) {
        map[cid] = { id: cid, name: f?.customerName || f?.deviceName || cid, count: 0 };
      }
      map[cid].count++;
    });
    return Object.values(map);
  })();

  async function generateTempQr() {
    const targetFolder = customerFolders.find((c) => c.id === tempCustName || c.name === tempCustName);
    const targetName = targetFolder ? targetFolder.name : tempCustName;
    if (!targetName.trim()) { alert('Please select a customer folder or enter customer token'); return; }
    try {
      const res = await axios.post(`${config.serverUrl}/api/qr/temp`, {
        customerName: targetName.trim(),
        expiry: tempExpiry,
        shopId,
        mode: 'upload',
        isViewOnly: false,
        targetCustomerId: targetFolder ? targetFolder.id : null,
      });
      if (res.data.success) {
        const newQr = res.data.qr;
        setTempQrs((prev) => [newQr, ...prev]);
        setTempSessionId(newQr.qrId);
        setTempQrOpen(true);
        setTempCustName('');
      }
    } catch (err) {
      alert('Error creating temp QR: ' + (err.response?.data?.error || err.message));
    }
  }

  async function generateViewOnlyQr() {
    const targetFolder = customerFolders.find((c) => c.id === viewCustFolderId);
    if (!targetFolder && !viewCustFolderId) {
      alert('Please select a customer folder');
      return;
    }
    const targetName = targetFolder ? targetFolder.name : viewCustFolderId;

    try {
      const res = await axios.post(`${config.serverUrl}/api/qr/temp`, {
        customerName: targetName,
        expiry: viewExpiry,
        shopId,
        mode: 'view_only',
        isViewOnly: true,
        targetCustomerId: targetFolder ? targetFolder.id : null,
      });
      if (res.data.success) {
        const newQr = res.data.qr;
        setTempQrs((prev) => [newQr, ...prev]);
        setActiveViewQrData({
          qrId: newQr.qrId,
          targetCustomerId: targetFolder ? targetFolder.id : null,
          customerName: targetName,
        });
        setViewQrOpen(true);
      }
    } catch (err) {
      alert('Error creating View-Only QR: ' + (err.response?.data?.error || err.message));
    }
  }

  function openFolderQr() {
    if (!folderCustId) { alert('Please select a customer folder'); return; }
    setFolderQrOpen(true);
  }

  async function revokeTemp(qrId) {
    try {
      await axios.post(`${config.serverUrl}/api/qr/temp/revoke`, { qrId });
      setTempQrs((prev) => prev.map((q) => (q.qrId === qrId || q.id === qrId) ? { ...q, active: false } : q));
    } catch {
      alert('Failed to revoke Temp QR');
    }
  }

  async function deleteTempQr(qrId) {
    if (!confirm('Are you sure you want to remove this QR record?')) return;
    try {
      await axios.delete(`${config.serverUrl}/api/qr/temp/${qrId}`);
    } catch {}
    setTempQrs((prev) => prev.filter((q) => (q.qrId !== qrId && q.id !== qrId)));
  }

  async function clearExpiredQrs() {
    if (!confirm('Clear all expired and revoked QR tokens?')) return;
    try {
      await axios.post(`${config.serverUrl}/api/qr/temp/clear-expired`, { shopId });
    } catch {}
    const now = Date.now();
    setTempQrs((prev) => prev.filter((q) => q.active && new Date(q.expiresAt).getTime() > now));
  }

  const [historyTab, setHistoryTab] = useState('active'); // 'active' | 'expired' | 'all'
  const [historySearch, setHistorySearch] = useState('');

  const activeCount = tempQrs.filter((q) => q.active && new Date(q.expiresAt).getTime() > Date.now()).length;
  const expiredCount = tempQrs.length - activeCount;

  const filteredTempQrs = useMemo(() => {
    const now = Date.now();
    return tempQrs.filter((q) => {
      const isExp = new Date(q.expiresAt).getTime() < now;
      const isActive = q.active && !isExp;

      if (historyTab === 'active' && !isActive) return false;
      if (historyTab === 'expired' && isActive) return false;

      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const name = (q.customerName || q.customer || '').toLowerCase();
        const token = (q.qrId || q.id || '').toLowerCase();
        return name.includes(query) || token.includes(query);
      }
      return true;
    });
  }, [tempQrs, historyTab, historySearch]);

  function timeLeft(expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    const diff = expTime - Date.now();
    if (diff <= 0) return 'Expired';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m left`;
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m left`;
  }

  // Live countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="qr-management-page">
      {/* Header */}
      <div className="qr-page-header">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>📱 QR Code Management</h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
            Create permanent, temporary upload, and time-limited customer View-Only QR codes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="qr-count-badge">Active Tokens: {tempQrs.filter((q) => q.active && new Date(q.expiresAt).getTime() > Date.now()).length}</span>
        </div>
      </div>

      {/* 4 QR Types Grid */}
      <div className="qr-types-grid">
        {/* Type 1: Permanent */}
        <QRTypeCard
          icon="📌"
          title="Permanent QR"
          desc="Always active. Used for counter standee. Uploads go to shared stream."
          badge="Permanent"
          color="#4F46E5"
        >
          <p className="qr-info-text">
            This QR never expires. Place it on your counter or standee. Any customer who scans can send files to your dashboard.
          </p>
          <div className="qr-session-id">
            <span className="qr-session-label">Session ID:</span>
            <code className="qr-session-val">{sessionId}</code>
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setPermQrOpen(true)}>
              📱 Open Permanent QR
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const shopPart = shopId ? `&shop=${encodeURIComponent(shopId)}` : '';
                const url = `${window.location.origin}/mobile?session=${encodeURIComponent(sessionId)}${shopPart}`;
                navigator.clipboard.writeText(url);
                alert('Permanent link copied!');
              }}
            >
              🔗 Copy Link
            </button>
          </div>
        </QRTypeCard>

        {/* Type 2: Customer View-Only with Expiry */}
        <QRTypeCard
          icon="👁️"
          title="Customer View-Only QR"
          desc="Time-limited portal. Customer can view their files & live print status."
          badge="View Portal"
          color="#7C3AED"
        >
          <div className="temp-form">
            <div>
              <label className="form-label">Select Customer Folder</label>
              <CustomFolderSelect
                folders={customerFolders}
                value={viewCustFolderId}
                onChange={setViewCustFolderId}
                placeholder="-- Choose Customer Folder --"
              />
            </div>
            <div>
              <label className="form-label">Access Expiry Time</label>
              <div className="expiry-segmented-group">
                {EXPIRY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`expiry-pill-btn ${viewExpiry === o.value ? 'active' : ''}`}
                    onClick={() => setViewExpiry(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-sm w-full" style={{ background: '#7C3AED', color: 'white', fontWeight: 700 }} onClick={generateViewOnlyQr}>
              👁️ Generate View-Only QR
            </button>
          </div>
        </QRTypeCard>

        {/* Type 3: Temporary Upload QR */}
        <QRTypeCard
          icon="⏱️"
          title="Temporary Upload QR"
          desc="Expires after set time. Creates a temporary upload token for walk-ins."
          badge="Time-Limited"
          color="#D97706"
        >
          <div className="temp-form">
            <div>
              <label className="form-label">Select Customer Folder</label>
              <CustomFolderSelect
                folders={customerFolders}
                value={tempCustName}
                onChange={setTempCustName}
                placeholder="-- Choose Customer Folder --"
              />
            </div>
            <div>
              <label className="form-label">Expires In</label>
              <div className="expiry-segmented-group">
                {EXPIRY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`expiry-pill-btn ${tempExpiry === o.value ? 'active' : ''}`}
                    onClick={() => setTempExpiry(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-sm w-full" style={{ background: '#D97706', color: 'white', fontWeight: 700 }} onClick={generateTempQr}>
              🔴 Generate Temp Upload QR
            </button>
          </div>
        </QRTypeCard>

        {/* Type 4: Folder-Specific Direct Upload */}
        <QRTypeCard
          icon="📂"
          title="Folder-Specific QR"
          desc="Files from ANY phone automatically route into the chosen folder."
          badge="Targeted"
          color="#059669"
        >
          <p className="qr-info-text">
            Share this QR with a specific customer and all uploads from their phone will go straight into their designated folder.
          </p>
          <div>
            <label className="form-label">Select Customer Folder</label>
            <CustomFolderSelect
              folders={customerFolders}
              value={folderCustId}
              onChange={setFolderCustId}
              placeholder="-- Select a customer folder --"
            />
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-sm w-full" style={{ background: '#059669', color: 'white', fontWeight: 700 }} onClick={openFolderQr}>
              📂 Generate Folder QR
            </button>
          </div>
        </QRTypeCard>
      </div>

      {/* Active Time-Limited QRs Section */}
      {tempQrs.length > 0 && (
        <div className="temp-qr-section">
          {/* Section Header with Tabs and Actions */}
          <div className="qr-history-toolbar mb-3">
            <div className="qr-history-title-row flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="section-title qr-history-title" style={{ margin: 0 }}>⏱️ QR History</h3>
                <span className="qr-count-badge">
                  {activeCount} Active
                </span>
              </div>

              {/* Clear Expired Button */}
              {expiredCount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ color: '#EF4444', borderColor: '#FECACA', background: '#FEF2F2' }}
                  onClick={clearExpiredQrs}
                  title="Remove all expired & revoked records"
                >
                  🗑️ Clear Expired ({expiredCount})
                </button>
              )}
            </div>

            {/* Tab Pills & Search */}
            <div className="qr-history-controls-row flex items-center justify-between gap-2 flex-wrap">
              {/* Tab Pills */}
              <div className="qr-history-tabs">
                <button
                  type="button"
                  className={`qr-history-tab-btn ${historyTab === 'active' ? 'active' : ''}`}
                  onClick={() => setHistoryTab('active')}
                >
                  🟢 Active ({activeCount})
                </button>
                <button
                  type="button"
                  className={`qr-history-tab-btn ${historyTab === 'expired' ? 'active' : ''}`}
                  onClick={() => setHistoryTab('expired')}
                >
                  ⏱️ Expired ({expiredCount})
                </button>
                <button
                  type="button"
                  className={`qr-history-tab-btn ${historyTab === 'all' ? 'active' : ''}`}
                  onClick={() => setHistoryTab('all')}
                >
                  📋 All ({tempQrs.length})
                </button>
              </div>

              {/* Search Bar */}
              <input
                type="text"
                className="input input-sm qr-search-input"
                placeholder="🔍 Search tokens..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* Empty State when tab filter has no results */}
          {filteredTempQrs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <span style={{ fontSize: '2rem' }}>{historyTab === 'active' ? '✨' : '📭'}</span>
              <p style={{ fontWeight: 700, margin: 0, color: '#334155' }}>
                {historyTab === 'active' ? 'No active temporary QR tokens right now' : 'No matching records found'}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                {historyTab === 'active' ? 'Generate a temporary upload or view-only QR using the cards above.' : 'All expired records are cleared.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="temp-qr-table-wrap desktop-qr-table-only">
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Customer / Folder</th>
                      <th>Token ID</th>
                      <th>Status & Validity</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTempQrs.map((q) => {
                      const targetId = q.qrId || q.id;
                      const expTime = new Date(q.expiresAt).getTime();
                      const expired = expTime < Date.now();
                      const isActive = q.active && !expired;
                      const isViewOnly = q.isViewOnly || q.mode === 'view_only';

                      return (
                        <tr key={targetId} className={!isActive ? 'qr-row-inactive' : ''}>
                          <td>
                            <span className={`qr-type-chip ${isViewOnly ? 'view' : 'upload'}`}>
                              {isViewOnly ? '👁️ View-Only' : '📤 Upload'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="customer-avatar-sm">
                                {(q.customerName || q.customer || 'C').charAt(0).toUpperCase()}
                              </span>
                              <span style={{ fontWeight: 800, color: '#0F172A' }}>
                                {q.customerName || q.customer}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <code className="token-code-pill">{targetId}</code>
                              <button
                                type="button"
                                className="btn-copy-token"
                                title="Copy Token ID"
                                onClick={() => {
                                  navigator.clipboard.writeText(targetId);
                                  alert('Token ID copied!');
                                }}
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td>
                            {isActive ? (
                              <span className="qr-status-badge active">
                                <span className="status-dot pulse" />
                                <strong>Active</strong> · {timeLeft(q.expiresAt)}
                              </span>
                            ) : expired ? (
                              <span className="qr-status-badge expired">
                                <span className="status-dot expired" />
                                Expired
                              </span>
                            ) : (
                              <span className="qr-status-badge revoked">
                                <span className="status-dot revoked" />
                                Revoked
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1.5">
                              {isActive ? (
                                <>
                                  <button
                                    className="btn btn-primary btn-xs"
                                    onClick={() => {
                                      if (isViewOnly) {
                                        setActiveViewQrData({
                                          qrId: targetId,
                                          targetCustomerId: q.targetCustomerId || null,
                                          customerName: q.customerName,
                                        });
                                        setViewQrOpen(true);
                                      } else {
                                        setTempSessionId(targetId);
                                        setTempQrOpen(true);
                                      }
                                    }}
                                  >
                                    📱 Show QR
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => {
                                      const shopPart = shopId ? `&shop=${encodeURIComponent(shopId)}` : '';
                                      const custPart = q.targetCustomerId ? `&customerId=${encodeURIComponent(q.targetCustomerId)}` : '';
                                      const viewPart = isViewOnly ? '&view=only' : '';
                                      const url = `${window.location.origin}/mobile?session=${encodeURIComponent(targetId)}${shopPart}${custPart}${viewPart}`;
                                      navigator.clipboard.writeText(url);
                                      alert('Link copied to clipboard!');
                                    }}
                                  >
                                    🔗 Copy Link
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-xs"
                                    style={{ color: '#EF4444' }}
                                    onClick={() => revokeTemp(targetId)}
                                    title="Revoke active token"
                                  >
                                    🚫 Revoke
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-xs"
                                  style={{ color: '#94A3B8' }}
                                  onClick={() => deleteTempQr(targetId)}
                                  title="Delete record"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile QR History Cards */}
              <div className="mobile-qr-history-list">
                {filteredTempQrs.map((q) => {
                  const targetId = q.qrId || q.id;
                  const expTime = new Date(q.expiresAt).getTime();
                  const expired = expTime < Date.now();
                  const isActive = q.active && !expired;
                  const isViewOnly = q.isViewOnly || q.mode === 'view_only';
                  const custName = q.customerName || q.customer || 'Customer';

                  return (
                    <div key={targetId} className={`mobile-qr-card ${!isActive ? 'inactive' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`qr-type-chip ${isViewOnly ? 'view' : 'upload'}`}>
                          {isViewOnly ? '👁️ View-Only' : '📤 Upload'}
                        </span>
                        {isActive ? (
                          <span className="qr-status-badge active">
                            <span className="status-dot pulse" />
                            <strong>Active</strong> · {timeLeft(q.expiresAt)}
                          </span>
                        ) : expired ? (
                          <span className="qr-status-badge expired">
                            <span className="status-dot expired" /> Expired
                          </span>
                        ) : (
                          <span className="qr-status-badge revoked">
                            <span className="status-dot revoked" /> Revoked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 my-1.5">
                        <span className="customer-avatar-sm">
                          {custName.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="mobile-qr-name">{custName}</div>
                          <div className="mobile-qr-token">
                            <code>{targetId}</code>
                            <button
                              type="button"
                              className="btn-copy-token"
                              onClick={() => {
                                navigator.clipboard.writeText(targetId);
                                alert('Token copied!');
                              }}
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mobile-qr-actions mt-3 flex items-center gap-2">
                        {isActive ? (
                          <>
                            <button
                              className="btn btn-primary btn-xs flex-1"
                              onClick={() => {
                                if (isViewOnly) {
                                  setActiveViewQrData({
                                    qrId: targetId,
                                    targetCustomerId: q.targetCustomerId || null,
                                    customerName: custName,
                                  });
                                  setViewQrOpen(true);
                                } else {
                                  setTempSessionId(targetId);
                                  setTempQrOpen(true);
                                }
                              }}
                            >
                              📱 Show QR
                            </button>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => {
                                const shopPart = shopId ? `&shop=${encodeURIComponent(shopId)}` : '';
                                const custPart = q.targetCustomerId ? `&customerId=${encodeURIComponent(q.targetCustomerId)}` : '';
                                const viewPart = isViewOnly ? '&view=only' : '';
                                const url = `${window.location.origin}/mobile?session=${encodeURIComponent(targetId)}${shopPart}${custPart}${viewPart}`;
                                navigator.clipboard.writeText(url);
                                alert('Link copied to clipboard!');
                              }}
                            >
                              🔗 Copy Link
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              style={{ color: '#EF4444', border: '1px solid #FECACA', background: '#FEF2F2', padding: '6px 10px', borderRadius: '8px' }}
                              onClick={() => revokeTemp(targetId)}
                              title="Revoke Token"
                            >
                              🚫
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-secondary btn-xs w-full"
                            style={{ color: '#EF4444' }}
                            onClick={() => deleteTempQr(targetId)}
                          >
                            🗑️ Delete Record
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* QR Modals */}
      <QRModal
        isOpen={permQrOpen}
        onClose={() => setPermQrOpen(false)}
        sessionId={sessionId}
        shopName={shop?.shopName}
        shopId={shop?.shopId}
      />

      {tempQrOpen && (
        <QRModal
          isOpen={tempQrOpen}
          onClose={() => setTempQrOpen(false)}
          sessionId={tempSessionId}
          shopName={`Temp Upload Token`}
          shopId={shop?.shopId}
        />
      )}

      {viewQrOpen && activeViewQrData && (
        <QRModal
          isOpen={viewQrOpen}
          onClose={() => setViewQrOpen(false)}
          sessionId={activeViewQrData.qrId}
          targetCustomerId={activeViewQrData.targetCustomerId}
          customerId={activeViewQrData.targetCustomerId}
          shopName={`${activeViewQrData.customerName} (View Portal)`}
          shopId={shop?.shopId}
          isViewOnly={true}
        />
      )}

      {folderQrOpen && folderCustId && (
        <QRModal
          isOpen={folderQrOpen}
          onClose={() => setFolderQrOpen(false)}
          sessionId={sessionId}
          customerId={folderCustId}
          targetCustomerId={folderCustId}
          shopName={
            customerFolders.find((c) => c.id === folderCustId)?.name ||
            shop?.shopName ||
            folderCustId
          }
          shopId={shop?.shopId}
        />
      )}

      <style>{`
        .qr-management-page { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
        .qr-page-header { display: flex; align-items: center; justify-content: space-between; }
        .qr-count-badge { font-size: 0.8rem; font-weight: 700; padding: 6px 14px; border-radius: 999px; background: #ECFDF5; color: #059669; border: 1px solid #D1FAE5; }
        .qr-types-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
        .qr-type-card { background: white; border: 1px solid #E2E8F0; border-radius: 20px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 1rem; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .qr-type-card:hover { border-color: var(--qc); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
        .qr-type-header { display: flex; align-items: flex-start; gap: 12px; }
        .qr-type-icon-wrap { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .qr-type-title { font-size: 1rem; font-weight: 900; color: #0F172A; }
        .qr-type-desc { font-size: 0.78rem; color: #64748B; margin-top: 3px; line-height: 1.5; }
        .qr-badge { font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; white-space: nowrap; }
        .qr-type-body { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; }
        .qr-info-text { font-size: 0.8rem; color: #64748B; line-height: 1.6; background: #F8FAFC; padding: 10px 12px; border-radius: 10px; border: 1px solid #F1F5F9; }
        .qr-session-id { display: flex; align-items: center; gap: 8px; background: #F8FAFC; padding: 8px 12px; border-radius: 8px; border: 1px solid #F1F5F9; }
        .qr-session-label { font-size: 0.75rem; font-weight: 700; color: #64748B; }
        .qr-session-val { font-size: 0.75rem; color: #4F46E5; }
        .qr-card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 8px; }
        .temp-form { display: flex; flex-direction: column; gap: 8px; }
        .form-label { display: block; font-size: 0.78rem; font-weight: 700; color: #374151; margin-bottom: 4px; }

        /* ── Custom Folder Select Dropdown ── */
        .custom-select-wrap {
          position: relative;
          width: 100%;
        }

        .custom-select-trigger {
          width: 100%;
          min-height: 40px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          font-size: 0.82rem;
          font-weight: 700;
          color: #0F172A;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
          outline: none;
        }

        .custom-select-trigger:hover {
          border-color: #CBD5E1;
          background: #F8FAFC;
        }

        .custom-select-trigger.open {
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
        }

        .custom-select-label.placeholder {
          color: #94A3B8;
          font-weight: 600;
        }

        .custom-select-count-badge {
          font-size: 0.7rem;
          font-weight: 700;
          background: #EEF2FF;
          color: #4F46E5;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid #C7D2FE;
        }

        .custom-select-chevron {
          font-size: 0.75rem;
          color: #64748B;
          transition: transform 0.2s ease;
        }

        .custom-select-chevron.open {
          transform: rotate(180deg);
        }

        .custom-select-backdrop {
          position: fixed;
          inset: 0;
          z-index: 999;
        }

        .custom-select-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #FFFFFF;
          border: 1px solid #CBD5E1;
          border-radius: 14px;
          box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.16), 0 6px 14px rgba(15, 23, 42, 0.06);
          z-index: 1000;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .custom-select-search-wrap {
          position: relative;
          width: 100%;
        }

        .custom-select-search-input {
          width: 100%;
          padding: 7px 28px 7px 10px;
          border-radius: 8px;
          border: 1.5px solid #E2E8F0;
          background: #F8FAFC;
          font-size: 0.78rem;
          font-weight: 600;
          color: #0F172A;
          box-sizing: border-box;
          outline: none;
          transition: all 0.15s ease;
        }

        .custom-select-search-input:focus {
          background: #FFFFFF;
          border-color: #4F46E5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
        }

        .custom-select-clear-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 0.7rem;
          cursor: pointer;
          padding: 2px;
        }

        .custom-select-options-list {
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .custom-select-option {
          padding: 8px 10px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 700;
          color: #334155;
          transition: all 0.12s ease;
        }

        .custom-select-option:hover {
          background: #EEF2FF;
          color: #4F46E5;
        }

        .custom-select-option.selected {
          background: #4F46E5;
          color: #FFFFFF;
        }

        .custom-select-option.selected .folder-opt-badge {
          background: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
        }

        .custom-select-option.custom-add-option {
          background: #F5F3FF;
          color: #7C3AED;
          border: 1px dashed #DDD6FE;
        }

        .custom-select-option.custom-add-option:hover {
          background: #EDE9FE;
        }

        .custom-select-empty {
          padding: 12px;
          text-align: center;
          font-size: 0.76rem;
          color: #94A3B8;
          font-weight: 600;
        }

        .folder-opt-badge {
          font-size: 0.68rem;
          font-weight: 700;
          background: #F1F5F9;
          color: #64748B;
          padding: 2px 6px;
          border-radius: 6px;
        }

        .folder-opt-badge.new {
          background: #DDD6FE;
          color: #7C3AED;
        }

        .temp-qr-table-wrap { background: white; border: 1px solid #E2E8F0; border-radius: 16px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04); width: 100%; }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th { background: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 0.76rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #E2E8F0; white-space: nowrap; }
        .print-table td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .print-table tr:last-child td { border-bottom: none; }

        /* ── Expiry Segmented Pills ── */
        .expiry-segmented-group {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          padding: 3px;
          border-radius: 12px;
          box-sizing: border-box;
          width: 100%;
        }

        .expiry-pill-btn {
          padding: 6px 4px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748B;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
          white-space: nowrap;
        }

        .expiry-pill-btn:hover {
          background: #FFFFFF;
          color: #0F172A;
        }

        .expiry-pill-btn.active {
          background: #FFFFFF;
          color: #4F46E5;
          border-color: #CBD5E1;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        /* ── QR History Toolbar & Tabs ── */
        .qr-history-toolbar {
          width: 100%;
        }

        .qr-history-tabs {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #F1F5F9;
          padding: 3px;
          border-radius: 9999px;
        }

        .qr-history-tab-btn {
          padding: 6px 12px;
          border-radius: 9999px;
          border: none;
          background: transparent;
          color: #64748B;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .qr-history-tab-btn:hover {
          color: #0F172A;
        }

        .qr-history-tab-btn.active {
          background: #FFFFFF;
          color: #4F46E5;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        }

        .qr-search-input {
          width: 160px;
        }

        /* ── Chips & Badges ── */
        .qr-type-chip {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .qr-type-chip.view {
          background: #F3E8FF;
          color: #7C3AED;
          border: 1px solid #DDD6FE;
        }

        .qr-type-chip.upload {
          background: #FEF3C7;
          color: #D97706;
          border: 1px solid #FDE68A;
        }

        .customer-avatar-sm {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #4F46E5;
          color: #FFFFFF;
          font-size: 0.72rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .token-code-pill {
          font-size: 0.72rem;
          color: #64748B;
          background: #F1F5F9;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1px solid #E2E8F0;
        }

        .btn-copy-token {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.75rem;
          opacity: 0.6;
          transition: opacity 0.15s ease;
          padding: 0 2px;
        }

        .btn-copy-token:hover {
          opacity: 1;
        }

        .qr-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .qr-status-badge.active {
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
        }

        .qr-status-badge.expired {
          background: #F8FAFC;
          color: #64748B;
          border: 1px solid #E2E8F0;
        }

        .qr-status-badge.revoked {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FECACA;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot.pulse {
          background: #059669;
          box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25);
        }

        .status-dot.expired {
          background: #94A3B8;
        }

        .status-dot.revoked {
          background: #DC2626;
        }

        .qr-row-inactive {
          opacity: 0.72;
          background: #FAFAFA;
        }

        .qr-row-inactive:hover {
          opacity: 1;
          background: #FFFFFF;
        }

        .mobile-qr-history-list { display: none; }

        @media (max-width: 768px) {
          .qr-management-page {
            padding-bottom: 90px;
          }

          .qr-history-tabs {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            width: 100%;
            gap: 2px;
          }

          .qr-history-tab-btn {
            padding: 7px 4px;
            font-size: 0.72rem;
            text-align: center;
          }

          .qr-search-input {
            width: 100%;
            margin-top: 4px;
          }

          .desktop-qr-table-only { display: none; }
          .mobile-qr-history-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }

          .mobile-qr-card {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 16px;
            padding: 14px 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .mobile-qr-card.inactive {
            opacity: 0.75;
            background: #FAFAFA;
          }

          .mobile-qr-name {
            font-size: 0.95rem;
            font-weight: 800;
            color: #0F172A;
            line-height: 1.2;
          }

          .mobile-qr-token {
            font-size: 0.74rem;
            color: #64748B;
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 2px;
          }
        }
      `}</style>
    </div>
  );
}
