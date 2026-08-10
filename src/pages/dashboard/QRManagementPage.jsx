/**
 * client/src/pages/dashboard/QRManagementPage.jsx
 * Page: QR Management — 4 QR Types (Permanent, Temp Upload, View-Only with Expiry, Folder-Specific)
 * Connected to Temp QR Backend REST APIs & DB Persistence
 */

import { useState, useEffect } from 'react';
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
    if (!tempCustName.trim()) { alert('Please enter customer name or token'); return; }
    try {
      const res = await axios.post(`${config.serverUrl}/api/qr/temp`, {
        customerName: tempCustName.trim(),
        expiry: tempExpiry,
        shopId,
        mode: 'upload',
        isViewOnly: false,
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
    const targetName = (targetFolder ? targetFolder.name : viewCustCustomName).trim();
    if (!targetName) {
      alert('Please select an existing customer folder or enter customer name');
      return;
    }

    try {
      const res = await axios.post(`${config.serverUrl}/api/qr/temp`, {
        customerName: targetName,
        expiry: viewExpiry,
        shopId,
        mode: 'view_only',
        isViewOnly: true,
        targetCustomerId: viewCustFolderId || null,
      });
      if (res.data.success) {
        const newQr = res.data.qr;
        setTempQrs((prev) => [newQr, ...prev]);
        setActiveViewQrData({
          qrId: newQr.qrId,
          targetCustomerId: viewCustFolderId || null,
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
              <select
                className="input input-sm"
                value={viewCustFolderId}
                onChange={(e) => setViewCustFolderId(e.target.value)}
              >
                <option value="">-- Choose Existing Folder --</option>
                {customerFolders.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.count} files)</option>
                ))}
              </select>
            </div>
            {!viewCustFolderId && (
              <div>
                <label className="form-label">Or Customer Name / Token</label>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="e.g. Ramesh Bhai #4"
                  value={viewCustCustomName}
                  onChange={(e) => setViewCustCustomName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="form-label">Access Expiry Time</label>
              <select className="input input-sm" value={viewExpiry} onChange={(e) => setViewExpiry(e.target.value)}>
                {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-sm w-full" style={{ background: '#7C3AED', color: 'white', fontWeight: 700 }} onClick={generateViewOnlyQr}>
              👁️ Generate View-Only QR
            </button>
          </div>
        </QRTypeCard>

        {/* Type 3: Temporary Upload */}
        <QRTypeCard
          icon="⏱️"
          title="Temporary Upload QR"
          desc="Expires after set time. Creates a temporary upload token for walk-ins."
          badge="Time-Limited"
          color="#D97706"
        >
          <div className="temp-form">
            <div>
              <label className="form-label">Customer Name / Token</label>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Ramesh Kumar or Token #5"
                value={tempCustName}
                onChange={(e) => setTempCustName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Expires In</label>
              <select className="input input-sm" value={tempExpiry} onChange={(e) => setTempExpiry(e.target.value)}>
                {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
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
            <select className="input input-sm" value={folderCustId} onChange={(e) => setFolderCustId(e.target.value)}>
              <option value="">-- Select a customer folder --</option>
              {customerFolders.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.count} files)</option>
              ))}
            </select>
          </div>
          <div className="qr-card-actions">
            <button className="btn btn-sm w-full" style={{ background: '#059669', color: 'white', fontWeight: 700 }} onClick={openFolderQr}>
              📂 Generate Folder QR
            </button>
          </div>
        </QRTypeCard>
      </div>

      {/* Active Time-Limited QRs Table */}
      {tempQrs.length > 0 && (
        <div className="temp-qr-section">
          <h3 className="section-title">⏱️ Active Temporary & View-Only QR History</h3>
          <div className="temp-qr-table-wrap">
            <table className="print-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Customer / Folder</th>
                  <th>Token ID</th>
                  <th>Time Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tempQrs.map((q) => {
                  const targetId = q.qrId || q.id;
                  const expTime = new Date(q.expiresAt).getTime();
                  const expired = expTime < Date.now();
                  const isActive = q.active && !expired;
                  const isViewOnly = q.isViewOnly || q.mode === 'view_only';

                  return (
                    <tr key={targetId}>
                      <td>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isViewOnly ? '#F3E8FF' : '#FEF3C7',
                          color: isViewOnly ? '#7C3AED' : '#D97706',
                          border: `1px solid ${isViewOnly ? '#DDD6FE' : '#FDE68A'}`,
                        }}>
                          {isViewOnly ? '👁️ View-Only' : '📤 Upload'}
                        </span>
                      </td>
                      <td><span style={{ fontWeight: 700 }}>{q.customerName || q.customer}</span></td>
                      <td><code style={{ fontSize: '0.75rem', color: '#64748B' }}>{targetId}</code></td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: isActive ? '#059669' : '#EF4444', fontWeight: 700 }}>
                          {!q.active ? '🚫 Revoked' : timeLeft(q.expiresAt)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${isActive ? 'printed' : 'pending'}`}>
                          {isActive ? '🟢 Active' : expired ? '⚫ Expired' : '🔴 Revoked'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
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
                                className="btn btn-ghost btn-xs"
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
                              <button className="btn btn-ghost btn-xs" style={{ color: '#EF4444' }} onClick={() => revokeTemp(targetId)}>
                                🚫 Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        .section-title { font-size: 0.95rem; font-weight: 800; color: #0F172A; margin-bottom: 0.75rem; }
        .temp-qr-table-wrap { background: white; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th { background: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 0.76rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #E2E8F0; }
        .print-table td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .print-table tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
