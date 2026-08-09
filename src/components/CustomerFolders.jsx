/**
 * client/src/components/CustomerFolders.jsx
 * Customer Folder Grouping Workspace — Hardware Fingerprint Isolated Folders
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCard } from './FileCard';
import { TextShare } from './TextShare';
import { QRModal } from './QRModal';

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
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [nicknames, setNicknames] = useState(getNicknames);
  const [editingNickId, setEditingNickId] = useState(null);
  const [nickInput, setNickInput] = useState('');
  const [folderFilter, setFolderFilter] = useState('all'); // 'all' | 'unprinted' | 'printed'
  const [searchQuery, setSearchQuery] = useState('');
  const [qrModalGroup, setQrModalGroup] = useState(null);

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
      setEditingNickId(null);
      setNickInput('');
    } catch (e) {
      console.warn('[Nickname Error]:', e);
    }
  };

  const handleDeleteCurrentFolder = async (custId) => {
    if (window.confirm('Are you sure you want to delete this customer folder and all its files?')) {
      if (onDeleteFolder) await onDeleteFolder(custId);
      setSelectedCustomerId(null);
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
            <div className="flex items-center gap-3 workspace-title-area">
              <button
                className="btn btn-ghost btn-sm btn-back-folders"
                onClick={() => setSelectedCustomerId(null)}
              >
                ← Back
              </button>
              <div className="min-w-0">
                <h3 className="workspace-title flex items-center gap-2">
                  📁 {nicknames[activeGroup.customerId] ? (
                    <>
                      <span>{nicknames[activeGroup.customerId]}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 400 }}>
                        ({activeGroup.customerName || activeGroup.deviceName})
                      </span>
                    </>
                  ) : (
                    <span>{activeGroup.customerName || activeGroup.deviceName}</span>
                  )}
                  <button
                    className="btn btn-ghost btn-xs text-xs"
                    onClick={() => {
                      setEditingNickId(activeGroup.customerId);
                      setNickInput(nicknames[activeGroup.customerId] || '');
                    }}
                    title="Add or Edit Shopkeeper Nickname"
                  >
                    ✏️ Edit
                  </button>
                </h3>
                <span className="workspace-sub">
                  {activeGroup.files.length} Files · {activeGroup.texts.length} Notes · ID: {activeGroup.customerId}
                </span>
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
                >
                  ✓ Mark Printed
                </button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteCurrentFolder(activeGroup.customerId)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          {editingNickId === activeGroup.customerId && (
            <div className="glass-card p-3 my-3 flex items-center gap-2" style={{ maxWidth: '500px' }}>
              <input
                type="text"
                className="input input-sm flex-1"
                placeholder="Enter shopkeeper nickname (e.g. Ramesh - Passport Size)..."
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={() => handleSaveNickname(activeGroup.customerId)}>
                Save
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingNickId(null)}>
                Cancel
              </button>
            </div>
          )}

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
                          title="Add / Edit Nickname"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNickId(group.customerId);
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
                            handleDeleteCurrentFolder(group.customerId);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="folder-info">
                      {editingNickId === group.customerId ? (
                        <div className="flex items-center gap-1 my-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="input input-xs flex-1"
                            placeholder="Shopkeeper Nickname..."
                            value={nickInput}
                            onChange={(e) => setNickInput(e.target.value)}
                            autoFocus
                          />
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveNickname(group.customerId);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
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
                      )}
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

      {/* Specific Customer Folder QR Share Modal */}
      {qrModalGroup && (
        <QRModal
          isOpen={!!qrModalGroup}
          onClose={() => setQrModalGroup(null)}
          sessionId={sessionId}
          shopName={nicknames[qrModalGroup.customerId] || qrModalGroup.customerName || qrModalGroup.deviceName}
          shopId={shop?.shopId}
          customerId={qrModalGroup.customerId}
        />
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
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .workspace-title {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--text-primary);
        }

        .workspace-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
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
        }
      `}</style>
    </div>
  );
}
