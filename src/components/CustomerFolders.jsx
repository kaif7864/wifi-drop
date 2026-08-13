/**
 * client/src/components/CustomerFolders.jsx
 * Customer Folder Grouping Workspace — Hardware Fingerprint Isolated Folders
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCard } from './FileCard';
import { TextShare } from './TextShare';
import { QRModal } from './QRModal';
import { ConfirmDeleteFolderModal } from './ConfirmDeleteFolderModal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function parseTime(dateVal) {
  if (!dateVal) return Date.now();
  const t = new Date(dateVal).getTime();
  return isNaN(t) ? Date.now() : t;
}

function normalizeCustomerId(item) {
  if (!item) return 'cust_anonymous';
  // Always prioritize explicit customerId (e.g. from targeted Folder QR)
  if (item.customerId && item.customerId !== 'cust_anonymous') {
    const match = item.customerId.match(/cust_(?:hw_)?([A-Z0-9]{6})/i);
    if (match) return `cust_hw_${match[1].toUpperCase()}`;
    return item.customerId;
  }
  if (item.deviceName) {
    const matchDev = item.deviceName.match(/#([A-Z0-9]{6})/i);
    if (matchDev) return `cust_hw_${matchDev[1].toUpperCase()}`;
  }
  if (item.customerName && item.customerName.trim()) {
    return `name_${item.customerName.toLowerCase().trim()}`;
  }
  return item.customerId || 'cust_anonymous';
}

function getNicknames() {
  try {
    return JSON.parse(localStorage.getItem('wifidrop_customer_nicknames') || '{}');
  } catch {
    return {};
  }
}

export function CustomerFolders({
  files = [],
  texts = [],
  onDeleteFile,
  onDeleteText,
  onDeleteFolder,
  onTogglePrint,
  sessionId,
  shop,
  initialCustomerId = null,
  onSelectCustomer,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [nicknames, setNicknames] = useState(getNicknames);
  const [editingGroup, setEditingGroup] = useState(null);
  const [nickInput, setNickInput] = useState('');
  const [folderFilter, setFolderFilter] = useState('all'); // 'all' | 'unprinted' | 'printed'
  const [searchQuery, setSearchQuery] = useState('');
  const [qrModalGroup, setQrModalGroup] = useState(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const handleSaveNickname = (custId) => {
    try {
      const updated = { ...nicknames };
      if (!nickInput || !nickInput.trim()) {
        delete updated[custId];
      } else {
        updated[custId] = nickInput.trim();
      }
      localStorage.setItem('wifidrop_customer_nicknames', JSON.stringify(updated));
      setNicknames(updated);
      setEditingGroup(null);
      setNickInput('');
    } catch (e) {
      console.warn('[Nickname Error]:', e);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteConfirmGroup) return;
    try {
      setIsDeletingFolder(true);
      if (onDeleteFolder) await onDeleteFolder(deleteConfirmGroup.customerId);
      if (selectedCustomerId === deleteConfirmGroup.customerId) {
        setSelectedCustomerId(null);
      }
      setDeleteConfirmGroup(null);
    } catch (e) {
      console.error('[Delete Folder Error]:', e);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Group files and texts strictly by physical hardware customerId & dynamically set latest customerName
  const customerGroups = useMemo(() => {
    const groups = {};

    (files || []).forEach((file) => {
      const custId = normalizeCustomerId(file);
      const fileTime = parseTime(file.savedAt || file.createdAt);

      if (!groups[custId]) {
        groups[custId] = {
          customerId: custId,
          deviceName: file.deviceName || 'Customer Mobile',
          customerName: file.customerName || null,
          latestNameTime: file.customerName ? fileTime : 0,
          files: [],
          texts: [],
          lastActivity: fileTime,
          unprintedCount: 0,
        };
      }

      // Update folder to the LATEST non-empty customerName entered across any browser on this device
      if (file.customerName && file.customerName.trim()) {
        if (!groups[custId].latestNameTime || fileTime >= groups[custId].latestNameTime) {
          groups[custId].customerName = file.customerName.trim();
          groups[custId].latestNameTime = fileTime;
        }
      }

      groups[custId].files.push(file);
      if (!file.printedStatus) groups[custId].unprintedCount += 1;
      if (fileTime > groups[custId].lastActivity) groups[custId].lastActivity = fileTime;
    });

    (texts || []).forEach((txt) => {
      const custId = normalizeCustomerId(txt);
      const textTime = parseTime(txt.receivedAt || txt.createdAt);

      if (!groups[custId]) {
        groups[custId] = {
          customerId: custId,
          deviceName: txt.deviceName || 'Customer Mobile',
          customerName: txt.customerName || null,
          latestNameTime: txt.customerName ? textTime : 0,
          files: [],
          texts: [],
          lastActivity: textTime,
          unprintedCount: 0,
        };
      }

      // Update folder to the LATEST non-empty customerName entered across any browser on this device
      if (txt.customerName && txt.customerName.trim()) {
        if (!groups[custId].latestNameTime || textTime >= groups[custId].latestNameTime) {
          groups[custId].customerName = txt.customerName.trim();
          groups[custId].latestNameTime = textTime;
        }
      }

      groups[custId].texts.push(txt);
      if (textTime > groups[custId].lastActivity) groups[custId].lastActivity = textTime;
    });

    return Object.values(groups).sort((a, b) => b.lastActivity - a.lastActivity);
  }, [files, texts]);

  // Auto-select folder if initialCustomerId is passed from Customers tab
  useEffect(() => {
    if (initialCustomerId) {
      const match = customerGroups.find((g) =>
        g.customerId === initialCustomerId ||
        g.customerId.toLowerCase() === initialCustomerId.toLowerCase() ||
        (g.customerName && g.customerName.toLowerCase() === initialCustomerId.toLowerCase()) ||
        g.files.some((f) => f.customerId === initialCustomerId || f.deviceName === initialCustomerId) ||
        g.texts.some((t) => t.customerId === initialCustomerId || t.deviceName === initialCustomerId)
      );
      if (match) {
        setSelectedCustomerId(match.customerId);
      } else {
        setSelectedCustomerId(initialCustomerId);
      }
    }
  }, [initialCustomerId, customerGroups]);

  // Filtered groups calculation based on search and status tabs
  const filteredCustomerGroups = useMemo(() => {
    return customerGroups.filter((g) => {
      const nickname = nicknames[g.customerId] || '';
      const matchSearch =
        !searchQuery ||
        g.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.deviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.customerId.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (folderFilter === 'unprinted') return g.unprintedCount > 0;
      if (folderFilter === 'printed') return g.unprintedCount === 0;
      return true;
    });
  }, [customerGroups, nicknames, searchQuery, folderFilter]);

  const activeGroup = useMemo(() => {
    return customerGroups.find((g) => g.customerId === selectedCustomerId) || null;
  }, [customerGroups, selectedCustomerId]);

  const unprintedFoldersCount = useMemo(() => {
    return customerGroups.filter((g) => g.unprintedCount > 0).length;
  }, [customerGroups]);

  return (
    <div className="customer-folders-container">
      {selectedCustomerId && activeGroup ? (
        /* ── SINGLE CUSTOMER FOLDER WORKSPACE VIEW ── */
        <div className="customer-workspace">
          <div className="workspace-header flex items-center justify-between">
            <div className="flex items-center gap-3.5 workspace-title-area">
              <button
                className="btn-back-circle"
                onClick={() => {
                  setSelectedCustomerId(null);
                  if (onSelectCustomer) onSelectCustomer(null);
                }}
                title="Back to All Folders"
              >
                ←
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="workspace-folder-icon">📁</span>
                  <h3 className="workspace-title">
                    {nicknames[activeGroup.customerId] ? (
                      <>
                        <span>{nicknames[activeGroup.customerId]}</span>
                        <span className="workspace-original-name">
                          ({activeGroup.customerName || activeGroup.deviceName})
                        </span>
                      </>
                    ) : (
                      <span>{activeGroup.customerName || activeGroup.deviceName}</span>
                    )}
                  </h3>
                  <button
                    className="btn-rename-subtle"
                    onClick={() => {
                      setEditingGroup(activeGroup);
                      setNickInput(nicknames[activeGroup.customerId] || '');
                    }}
                    title="Rename / Edit Nickname"
                  >
                    ✏️
                  </button>
                </div>
                <div className="workspace-meta-row flex items-center gap-2 mt-1">
                  <span className="workspace-meta-badge">📄 {activeGroup.files.length} Files</span>
                  <span className="meta-dot">·</span>
                  <span className="workspace-meta-badge">💬 {activeGroup.texts.length} Notes</span>
                  <span className="meta-dot">·</span>
                  <span className="workspace-id-chip">ID: {activeGroup.customerId}</span>
                </div>
              </div>
            </div>

            <div className="workspace-header-actions flex items-center gap-2">
              <button
                className="btn btn-primary btn-sm btn-folder-qr"
                onClick={() => setQrModalGroup(activeGroup)}
                title="Share QR Code for this specific Customer Folder"
              >
                📱 Share Folder QR
              </button>
              {activeGroup.files.some((f) => !f.printedStatus) && onTogglePrint && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    activeGroup.files.forEach((f) => {
                      if (!f.printedStatus) onTogglePrint(f);
                    });
                  }}
                  title="Mark all files in this customer folder as printed"
                >
                  ✓ Mark All Printed
                </button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setDeleteConfirmGroup(activeGroup)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          <div className="workspace-section">
            <h4 className="section-heading">Received Documents & Files ({activeGroup.files.length})</h4>
            {activeGroup.files.length === 0 ? (
              <p className="empty-sub">No files in this folder.</p>
            ) : (
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {activeGroup.files.map((file) => (
                    <FileCard
                      key={file.uuid || file.id || file._id}
                      file={file}
                      onDelete={onDeleteFile}
                      onTogglePrint={onTogglePrint}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {activeGroup.texts.length > 0 && (
            <div className="workspace-section">
              <h4 className="section-heading">Shared Text Notes ({activeGroup.texts.length})</h4>
              <div className="file-list">
                <AnimatePresence mode="popLayout">
                  {activeGroup.texts.map((t) => (
                    <TextShare key={t.uuid || t.id || t._id} textRecord={t} onDelete={onDeleteText} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── CUSTOMER FOLDERS GRID VIEW ── */
        <div className="customer-folders-main">
          {/* Top Filter Tabs & Search Bar */}
          <div className="folder-controls-bar flex items-center justify-between mb-4 gap-3">
            <div className="folder-tabs flex gap-2">
              <button
                className={`tab-chip ${folderFilter === 'all' ? 'active' : ''}`}
                onClick={() => setFolderFilter('all')}
              >
                📁 All Folders ({customerGroups.length})
              </button>
              <button
                className={`tab-chip ${folderFilter === 'unprinted' ? 'active' : ''}`}
                onClick={() => setFolderFilter('unprinted')}
              >
                🔴 Pending Print ({unprintedFoldersCount})
              </button>
              <button
                className={`tab-chip ${folderFilter === 'printed' ? 'active' : ''}`}
                onClick={() => setFolderFilter('printed')}
              >
                ✓ All Printed ({customerGroups.length - unprintedFoldersCount})
              </button>
            </div>

            <div style={{ maxWidth: '280px', width: '100%' }}>
              <input
                type="text"
                className="input input-sm"
                placeholder="🔍 Search customer name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="folders-grid">
            {filteredCustomerGroups.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📂</span>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No Customer Folders Found</p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {searchQuery || folderFilter !== 'all'
                    ? 'No folders match your current filter or search query.'
                    : 'Scan the QR code on mobile and upload files to create customer folders automatically.'}
                </p>
              </div>
            ) : (
              filteredCustomerGroups.map((group) => {
                const totalSize = group.files.reduce((acc, f) => acc + (f.size || 0), 0);
                const timeStr = new Date(group.lastActivity).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <motion.div
                    key={group.customerId}
                    className="folder-card glass-card"
                    onClick={() => setSelectedCustomerId(group.customerId)}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  >
                    <div className="folder-icon-wrapper">
                      <span className="folder-icon">📁</span>
                      <div className="flex items-center gap-2">
                        {group.unprintedCount > 0 && (
                          <span className="folder-badge" title={`${group.unprintedCount} unprinted items`}>
                            {group.unprintedCount} New
                          </span>
                        )}
                        {group.unprintedCount > 0 && onTogglePrint && (
                          <button
                            className="btn-icon"
                            style={{ color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5' }}
                            title={`Mark all ${group.unprintedCount} files in this folder as printed`}
                            onClick={(e) => {
                              e.stopPropagation();
                              group.files.forEach((f) => {
                                if (!f.printedStatus) onTogglePrint(f);
                              });
                            }}
                          >
                            🖨️
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          title="Share QR for this Customer Folder"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrModalGroup(group);
                          }}
                        >
                          📱
                        </button>
                        <button
                          className="btn-icon btn-secondary-icon"
                          title="Rename Customer Folder"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setNickInput(nicknames[group.customerId] || '');
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-danger-icon"
                          title="Delete Customer Folder"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmGroup(group);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="folder-info">
                      <h3 className="folder-name">
                        {nicknames[group.customerId] ? (
                          <>
                            <span style={{ color: 'var(--accent-color, #6366f1)' }}>
                              🏷️ {nicknames[group.customerId]}
                            </span>{' '}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              ({group.customerName || group.deviceName})
                            </span>
                          </>
                        ) : (
                          group.customerName || group.deviceName
                        )}
                      </h3>
                      <p className="folder-meta">
                        {group.files.length} Files ({formatBytes(totalSize)})
                      </p>
                      <span className="folder-time">Active {timeStr}</span>
                    </div>

                    <button className="btn btn-ghost btn-xs folder-open-btn">
                      Open Folder ↗
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Specific Customer Folder QR Modal */}
      {qrModalGroup && (
        <QRModal
          isOpen={Boolean(qrModalGroup)}
          onClose={() => setQrModalGroup(null)}
          customerId={qrModalGroup.customerId}
          customerName={qrModalGroup.customerName}
          deviceName={qrModalGroup.deviceName}
          shopId={shop?.shopId || 'default'}
          shopName={shop?.shopName || 'WiFi Drop'}
        />
      )}

      {/* Permanent Delete Confirmation Modal with Never Restore Warning */}
      {deleteConfirmGroup && (
        <ConfirmDeleteFolderModal
          group={deleteConfirmGroup}
          onConfirm={handleConfirmPermanentDelete}
          onCancel={() => setDeleteConfirmGroup(null)}
          isDeleting={isDeletingFolder}
        />
      )}

      {/* Dedicated Rename Customer Folder Modal */}
      {editingGroup && (
        <div className="rename-modal-overlay" onClick={() => setEditingGroup(null)}>
          <motion.div
            className="rename-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge">🏷️</div>
              <div>
                <h3 className="rename-modal-title">Rename Customer Folder</h3>
                <p className="rename-modal-sub">
                  Device: {editingGroup.customerName || editingGroup.deviceName || editingGroup.customerId}
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveNickname(editingGroup.customerId);
              }}
            >
              <div className="rename-modal-body">
                <label className="rename-input-label">Folder Name / Nickname</label>
                <input
                  type="text"
                  className="input rename-text-input"
                  placeholder="e.g. Ramesh - Passport Size Photo, urgent..."
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  autoFocus
                />
                <p className="rename-input-hint">
                  💡 Tip: Leave empty to reset to default customer device name.
                </p>
              </div>

              <div className="rename-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost rename-btn"
                  onClick={() => setEditingGroup(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rename-btn"
                >
                  💾 Save Name
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <style>{`
        .customer-folders-container {
          width: 100%;
        }

        .customer-folders-main {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .folder-controls-bar {
          background: #ffffff;
          padding: 12px 18px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .folder-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 9999px;
          border: 1px solid #e2e8f0;
        }

        .tab-chip {
          padding: 7px 16px;
          border-radius: 9999px;
          border: none;
          background: transparent;
          font-size: 0.82rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .tab-chip:hover {
          color: #0f172a;
        }

        .tab-chip.active {
          background: #ffffff;
          color: #4f46e5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .folders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-5);
        }

        .folder-card {
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          cursor: pointer;
          border: 1px solid var(--border);
          background: #ffffff;
          border-radius: var(--radius-xl);
          transition: all 0.2s ease;
        }

        .folder-card:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.12);
        }

        .folder-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .folder-icon { font-size: 2.2rem; }

        .folder-badge {
          background: var(--danger);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        .folder-name {
          font-size: var(--font-size-md);
          font-weight: 800;
          color: var(--text-primary);
        }

        .folder-meta {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
        }

        .folder-time {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
          display: block;
        }

        .workspace-header {
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .btn-back-circle {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #334155;
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .btn-back-circle:hover {
          background: #F1F5F9;
          border-color: #CBD5E1;
          color: #0F172A;
          transform: translateX(-2px);
        }

        .workspace-folder-icon {
          font-size: 1.4rem;
          line-height: 1;
        }

        .workspace-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.2;
        }

        .workspace-original-name {
          font-size: 0.82rem;
          font-weight: 500;
          color: #64748B;
          margin-left: 6px;
        }

        .btn-rename-subtle {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          opacity: 0.75;
        }

        .btn-rename-subtle:hover {
          opacity: 1;
          background: #EEF2FF;
          border-color: #C7D2FE;
          transform: scale(1.1);
        }

        .workspace-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .workspace-meta-badge {
          font-weight: 700;
          color: #475569;
        }

        .workspace-id-chip {
          background: #F1F5F9;
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #64748B;
        }

        .workspace-section {
          margin-bottom: var(--space-6);
        }

        .section-heading {
          font-size: var(--font-size-sm);
          font-weight: 700;
          margin-bottom: var(--space-3);
          color: var(--text-secondary);
        }

        .empty-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        /* ── Mobile Responsive Breakpoints (Zero Scrollbars) ── */
        @media (max-width: 768px) {
          .customer-folders-main {
            gap: 0.75rem;
          }

          .folder-controls-bar {
            padding: 8px;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            overflow: visible;
          }

          .folder-controls-bar > div:last-child {
            max-width: 100% !important;
            width: 100% !important;
          }

          .folder-tabs {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            width: 100%;
            padding: 3px;
            gap: 2px;
            overflow: visible;
          }

          .tab-chip {
            padding: 6px 2px;
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            justify-content: center;
          }

          .folders-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 0.75rem;
          }

          .folder-card {
            padding: 1rem;
            border-radius: 14px;
          }

          .folder-icon {
            font-size: 1.7rem;
          }

          .folder-name {
            font-size: 0.88rem;
          }

          .workspace-header {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            margin-bottom: 0.75rem;
            padding-bottom: 0.75rem;
          }

          .workspace-title-area {
            width: 100%;
            gap: 8px;
          }

          .workspace-title {
            font-size: 0.95rem;
          }

          .workspace-sub {
            font-size: 11px;
          }

          .workspace-header-actions {
            width: 100%;
            display: flex;
            gap: 6px;
          }

          .workspace-header-actions .btn {
            flex: 1;
            padding: 6px 8px;
            font-size: 11px;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .folders-grid {
            grid-template-columns: 1fr;
          }

          .btn-back-folders {
            padding: 4px 8px;
            font-size: 11px;
          }

          .btn-folder-qr {
            width: 100%;
          }
        }

        /* ── Dedicated Rename Modal Styling ── */
        .rename-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(6px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .rename-modal {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 20px;
          max-width: 440px;
          width: 100%;
          padding: 1.5rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .rename-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rename-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #EEF2FF;
          border: 1px solid #C7D2FE;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          flex-shrink: 0;
        }

        .rename-modal-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
        }

        .rename-modal-sub {
          font-size: 0.76rem;
          color: #64748B;
          margin: 2px 0 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }

        .rename-modal-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rename-input-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #334155;
        }

        .rename-text-input {
          height: 44px;
          font-size: 0.92rem;
          font-weight: 600;
          border-radius: 12px;
          padding: 0 14px;
          border: 1.5px solid #CBD5E1;
          transition: all 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .rename-text-input:focus {
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .rename-input-hint {
          font-size: 0.72rem;
          color: #64748B;
          margin: 4px 0 0 0;
        }

        .rename-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 1.25rem;
        }

        .rename-btn {
          padding: 9px 18px !important;
          font-size: 0.86rem !important;
          font-weight: 700 !important;
          border-radius: 10px !important;
        }

        @media (max-width: 480px) {
          .rename-modal {
            padding: 1.25rem;
          }

          .rename-modal-actions {
            flex-direction: column-reverse;
            width: 100%;
          }

          .rename-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
