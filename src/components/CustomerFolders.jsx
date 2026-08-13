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
import { FolderPicker } from './FolderPicker';


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
  // Always prioritize explicit customerId
  if (item.customerId && item.customerId !== 'cust_anonymous') {
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
  // Shop owner custom folders
  shopFolders = [],
  onCreateShopFolder,
  onFetchShopFolders,
  onUploadFilesToFolder,
  onDeleteShopFolder,
  onRenameShopFolder,
  onMoveFile,
  onCopyFile,
  onBulkMoveFiles,
  onBulkCopyFiles,
  onBulkDeleteFiles,
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

  // Multi-Selection State across files
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [bulkActionModal, setBulkActionModal] = useState(null); // 'move' | 'copy' | 'delete'

  // Shop Owner Folder States
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState('');
  const [selectedShopFolder, setSelectedShopFolder] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(null); // folderId
  const [uploadingToFolder, setUploadingToFolder] = useState(false);
  const [uploadFolderProgress, setUploadFolderProgress] = useState(0);
  const [folderUploadError, setFolderUploadError] = useState('');
  const [folderUploadSuccess, setFolderUploadSuccess] = useState(false);
  const [shopFolderDeleteConfirm, setShopFolderDeleteConfirm] = useState(null);
  const [isDeletingShopFolder, setIsDeletingShopFolder] = useState(false);
  const [mainTab, setMainTab] = useState('customer'); // 'customer' | 'shop'
  const [qrModalShopFolder, setQrModalShopFolder] = useState(null);

  // Shop Owner Rename Folder State
  const [editingShopFolder, setEditingShopFolder] = useState(null);
  const [renameShopFolderName, setRenameShopFolderName] = useState('');
  const [renameShopFolderDesc, setRenameShopFolderDesc] = useState('');
  const [isRenamingShopFolder, setIsRenamingShopFolder] = useState(false);
  const [renameShopFolderError, setRenameShopFolderError] = useState('');

  // Move / Copy File State
  const [moveCopyTargetFile, setMoveCopyTargetFile] = useState(null);
  const [moveCopyMode, setMoveCopyMode] = useState('move'); // 'move' | 'copy'
  const [destFolderId, setDestFolderId] = useState('');
  const [isProcessingMoveCopy, setIsProcessingMoveCopy] = useState(false);
  const [moveCopyError, setMoveCopyError] = useState('');




  // Fetch shop folders on mount
  useEffect(() => {
    if (onFetchShopFolders && shop?.shopId) {
      onFetchShopFolders();
    }
  }, [onFetchShopFolders, shop?.shopId]);

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
      // Exclude files moved to a specific shop folder from general customer folders
      if (file.folderId) return;

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

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setCreateFolderError('Folder ka naam dena zaruri hai!');
      return;
    }
    setIsCreatingFolder(true);
    setCreateFolderError('');
    try {
      await onCreateShopFolder({ folderName: newFolderName.trim(), description: newFolderDesc.trim() });
      setShowCreateFolderModal(false);
      setNewFolderName('');
      setNewFolderDesc('');
    } catch (err) {
      setCreateFolderError(err.response?.data?.error || err.message || 'Folder create nahi ho saka.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUploadToFolder = async (e, folder) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadingToFolder(true);
    setFolderUploadError('');
    setFolderUploadSuccess(false);
    setUploadFolderProgress(0);
    try {
      await onUploadFilesToFolder(fileList, folder.folderId);
      setFolderUploadSuccess(true);
      setTimeout(() => {
        setShowUploadModal(null);
        setFolderUploadSuccess(false);
      }, 1800);
    } catch (err) {
      setFolderUploadError(err.response?.data?.error || err.message || 'Upload fail ho gaya.');
    } finally {
      setUploadingToFolder(false);
    }
  };

  const handleDeleteShopFolder = async () => {
    if (!shopFolderDeleteConfirm) return;
    setIsDeletingShopFolder(true);
    try {
      await onDeleteShopFolder(shopFolderDeleteConfirm.folderId);
      if (selectedShopFolder?.folderId === shopFolderDeleteConfirm.folderId) {
        setSelectedShopFolder(null);
      }
      setShopFolderDeleteConfirm(null);
    } catch (err) {
      console.error('[DeleteShopFolder]:', err);
    } finally {
      setIsDeletingShopFolder(false);
    }
  };

  const handleRenameShopFolder = async (e) => {
    e.preventDefault();
    if (!editingShopFolder) return;
    if (!renameShopFolderName.trim()) {
      setRenameShopFolderError('Folder name cannot be empty');
      return;
    }
    setIsRenamingShopFolder(true);
    setRenameShopFolderError('');
    try {
      await onRenameShopFolder(editingShopFolder.folderId, {
        folderName: renameShopFolderName.trim(),
        description: renameShopFolderDesc.trim(),
      });
      if (selectedShopFolder?.folderId === editingShopFolder.folderId) {
        setSelectedShopFolder((prev) => prev ? { ...prev, folderName: renameShopFolderName.trim(), description: renameShopFolderDesc.trim() } : null);
      }
      setEditingShopFolder(null);
    } catch (err) {
      setRenameShopFolderError(err.response?.data?.error || err.message || 'Failed to rename folder');
    } finally {
      setIsRenamingShopFolder(false);
    }
  };

  const handleExecuteMoveCopy = async (e) => {
    if (e) e.preventDefault();
    if (!moveCopyTargetFile) return;
    const fileId = moveCopyTargetFile.uuid || moveCopyTargetFile.id || moveCopyTargetFile._id;
    setIsProcessingMoveCopy(true);
    setMoveCopyError('');
    try {
      if (moveCopyMode === 'move') {
        if (onMoveFile) {
          await onMoveFile(fileId, destFolderId || null);
        }
      } else {
        if (onCopyFile) {
          await onCopyFile(fileId, destFolderId || null);
        }
      }
      setMoveCopyTargetFile(null);
    } catch (err) {
      setMoveCopyError(err.response?.data?.error || err.message || 'Operation failed');
    } finally {
      setIsProcessingMoveCopy(false);
    }
  };

  const handleToggleSelectFile = (fileId) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleSelectAllInList = (fileList) => {
    const ids = fileList.map((f) => f.uuid || f.id || f._id);
    setSelectedFileIds(new Set(ids));
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleExecuteBulkAction = async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;
    setIsProcessingMoveCopy(true);
    setMoveCopyError('');
    try {
      if (bulkActionModal === 'move') {
        if (onBulkMoveFiles) await onBulkMoveFiles(ids, destFolderId || null);
      } else if (bulkActionModal === 'copy') {
        if (onBulkCopyFiles) await onBulkCopyFiles(ids, destFolderId || null);
      } else if (bulkActionModal === 'delete') {
        if (onBulkDeleteFiles) {
          await onBulkDeleteFiles(ids);
        } else if (onDeleteFile) {
          for (const id of ids) {
            await onDeleteFile(id);
          }
        }
      }
      setBulkActionModal(null);
      setSelectedFileIds(new Set());
    } catch (err) {
      setMoveCopyError(err.response?.data?.error || err.message || 'Bulk operation failed');
    } finally {
      setIsProcessingMoveCopy(false);
    }
  };




  return (
    <div className="customer-folders-container">
      {/* ── Main Tab Switcher — shown only when not in a workspace ── */}
      {!selectedCustomerId && !selectedShopFolder && shop?.shopId && (
        <div className="main-tab-switcher">
          <button
            className={`main-tab-btn ${mainTab === 'customer' ? 'active' : ''}`}
            onClick={() => setMainTab('customer')}
          >
            📁 Customer Folders
            {customerGroups.length > 0 && (
              <span className="main-tab-count">{customerGroups.length}</span>
            )}
          </button>
          <button
            className={`main-tab-btn ${mainTab === 'shop' ? 'active' : ''}`}
            onClick={() => { setMainTab('shop'); }}
          >
            🗂️ My Shop Folders
            {shopFolders.length > 0 && (
              <span className="main-tab-count shop-tab-count">{shopFolders.length}</span>
            )}
          </button>
        </div>
      )}

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
              {onCreateShopFolder && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCreateFolderModal(true)}
                  title="Create a new folder"
                >
                  ➕ New Folder
                </button>
              )}
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
                      onMoveCopy={(f) => {
                        setMoveCopyTargetFile(f);
                        setDestFolderId(f.folderId || '');
                        setMoveCopyError('');
                      }}
                      isSelectable={true}
                      isSelected={selectedFileIds.has(file.uuid || file.id || file._id)}
                      onSelectToggle={handleToggleSelectFile}
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
      ) : selectedShopFolder ? (
        /* ── SHOP FOLDER WORKSPACE VIEW ── */
        <div className="shop-folder-workspace">
          <div className="workspace-header flex items-center justify-between">
            <div className="flex items-center gap-3.5 workspace-title-area">
              <button
                className="btn-back-circle"
                onClick={() => setSelectedShopFolder(null)}
                title="Back to All Folders"
              >
                ←
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="workspace-folder-icon">🗂️</span>
                  <h3 className="workspace-title">{selectedShopFolder.folderName}</h3>
                  <button
                    className="btn-rename-subtle"
                    onClick={() => {
                      setEditingShopFolder(selectedShopFolder);
                      setRenameShopFolderName(selectedShopFolder.folderName || '');
                      setRenameShopFolderDesc(selectedShopFolder.description || '');
                      setRenameShopFolderError('');
                    }}
                    title="Rename Folder"
                  >
                    ✏️
                  </button>
                  <span className="shop-folder-badge-tag">My Folder</span>
                </div>
                {selectedShopFolder.description && (
                  <p className="workspace-sub">{selectedShopFolder.description}</p>
                )}
                <div className="workspace-meta-row flex items-center gap-2 mt-1">
                  <span className="workspace-meta-badge">📄 {files.filter(f => f.folderId === selectedShopFolder.folderId).length} Files</span>
                  <span className="meta-dot">·</span>
                  <span className="workspace-id-chip">ID: {selectedShopFolder.folderId}</span>
                </div>
              </div>
            </div>


            <div className="workspace-header-actions flex items-center gap-2">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditingShopFolder(selectedShopFolder);
                  setRenameShopFolderName(selectedShopFolder.folderName || '');
                  setRenameShopFolderDesc(selectedShopFolder.description || '');
                  setRenameShopFolderError('');
                }}
                title="Rename this folder"
              >
                ✏️ Rename
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setQrModalShopFolder(selectedShopFolder)}
                title="Generate QR code for this folder — customer scans to upload directly"
              >
                📱 Share QR
              </button>
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleUploadToFolder(e, selectedShopFolder)}
                />
                {uploadingToFolder ? '⏳ Uploading...' : '📤 Upload Files'}
              </label>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShopFolderDeleteConfirm(selectedShopFolder)}
              >
                🗑️ Delete Folder
              </button>
            </div>

          </div>

          {uploadingToFolder && (
            <div className="folder-upload-progress">
              <div className="folder-upload-bar" style={{ width: `${uploadFolderProgress}%` }} />
              <span>{uploadFolderProgress}%</span>
            </div>
          )}
          {folderUploadError && (
            <div className="folder-upload-error">❌ {folderUploadError}</div>
          )}
          {folderUploadSuccess && (
            <div className="folder-upload-success">✅ Files uploaded successfully!</div>
          )}

          {/* Files that belong to this folder */}
          {(() => {
            const folderFiles = files.filter(f => f.folderId === selectedShopFolder.folderId);
            return (
              <div className="workspace-section">
                <h4 className="section-heading">Files in this Folder ({folderFiles.length})</h4>
                {folderFiles.length === 0 ? (
                  <div className="shop-folder-empty">
                    <span style={{ fontSize: '2.5rem' }}>📂</span>
                    <p>No files in this folder yet.</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Click "Upload Files" to add files here.</p>
                  </div>
                ) : (
                  <div className="file-list">
                    <AnimatePresence mode="popLayout">
                      {folderFiles.map((file) => (
                        <FileCard
                          key={file.uuid || file.id || file._id}
                          file={file}
                          onDelete={onDeleteFile}
                          onTogglePrint={onTogglePrint}
                          onMoveCopy={(f) => {
                            setMoveCopyTargetFile(f);
                            setDestFolderId(f.folderId || '');
                            setMoveCopyError('');
                          }}
                          isSelectable={true}
                          isSelected={selectedFileIds.has(file.uuid || file.id || file._id)}
                          onSelectToggle={handleToggleSelectFile}
                        />


                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* ── GRID VIEW (tab-switched) ── */
        <div className="customer-folders-main">

          {/* ── SHOP FOLDERS TAB ── */}
          {mainTab === 'shop' && (
            <>
              <div className="folder-controls-bar flex items-center justify-between mb-4 gap-3">
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  🗂️ {shopFolders.length} folder{shopFolders.length !== 1 ? 's' : ''}
                </span>
                {onCreateShopFolder && (
                  <button
                    className="btn btn-primary btn-sm new-folder-btn"
                    onClick={() => setShowCreateFolderModal(true)}
                  >
                    ➕ New Folder
                  </button>
                )}
              </div>

              {shopFolders.length === 0 ? (
                <div className="create-folder-cta">
                  <span style={{ fontSize: '2.5rem' }}>🗂️</span>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '10px 0 4px' }}>
                    Apna pehla folder banao!
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                    Customer ke naam se folder bana, QR generate karo,<br />
                    customer scan kare aur files seedha us folder me jayen
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCreateFolderModal(true)}>
                    ➕ Pehla Folder Banao
                  </button>
                </div>
              ) : (
                <div className="folders-grid">
                  {shopFolders.map((folder) => {
                    const folderFiles = files.filter(f => f.folderId === folder.folderId);
                    return (
                      <motion.div
                        key={folder.folderId}
                        className="folder-card shop-folder-card glass-card"
                        onClick={() => setSelectedShopFolder(folder)}
                        whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      >
                        <div className="folder-icon-wrapper">
                          <span className="folder-icon">🗂️</span>
                          <div className="flex items-center gap-2">
                            <span className="shop-folder-badge-tag">My Folder</span>
                            <button
                              className="btn-icon btn-secondary-icon"
                              title="Rename this folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingShopFolder(folder);
                                setRenameShopFolderName(folder.folderName || '');
                                setRenameShopFolderDesc(folder.description || '');
                                setRenameShopFolderError('');
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-icon"
                              title="Share QR — customer scans to upload"
                              onClick={(e) => { e.stopPropagation(); setQrModalShopFolder(folder); }}
                            >
                              📱
                            </button>
                            <button
                              className="btn-icon btn-danger-icon"
                              title="Delete this folder"
                              onClick={(e) => { e.stopPropagation(); setShopFolderDeleteConfirm(folder); }}
                            >
                              🗑️
                            </button>
                          </div>

                        </div>
                        <div className="folder-info">
                          <h3 className="folder-name">{folder.folderName}</h3>
                          {folder.description && (
                            <p className="folder-meta" style={{ fontStyle: 'italic', color: '#64748B' }}>{folder.description}</p>
                          )}
                          <p className="folder-meta" style={{ marginTop: '2px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>ID: </span>
                            <code style={{ background: '#EEF2FF', padding: '1px 5px', borderRadius: '4px', color: '#4F46E5', fontSize: '0.72rem', fontWeight: 700 }}>{folder.folderId}</code>
                          </p>
                          <p className="folder-meta">
                            {folderFiles.length} Files
                            {folderFiles.length > 0 ? ` · ${formatBytes(folderFiles.reduce((a, f) => a + (f.size || 0), 0))}` : ''}
                          </p>
                          <span className="folder-time">
                            Created {new Date(folder.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            style={{ flex: 1 }}
                            onClick={(e) => { e.stopPropagation(); setQrModalShopFolder(folder); }}
                          >
                            📱 Share QR
                          </button>
                          <button className="btn btn-ghost btn-xs folder-open-btn" style={{ flex: 1 }}>
                            Open ↗
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── CUSTOMER FOLDERS TAB ── */}
          {mainTab === 'customer' && (
            <>
              <div className="folder-controls-bar flex items-center justify-between mb-4 gap-3">
                <div className="folder-tabs flex gap-2">
                  <button
                    className={`tab-chip ${folderFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setFolderFilter('all')}
                  >
                    📁 All ({customerGroups.length})
                  </button>
                  <button
                    className={`tab-chip ${folderFilter === 'unprinted' ? 'active' : ''}`}
                    onClick={() => setFolderFilter('unprinted')}
                  >
                    🔴 Pending ({unprintedFoldersCount})
                  </button>
                  <button
                    className={`tab-chip ${folderFilter === 'printed' ? 'active' : ''}`}
                    onClick={() => setFolderFilter('printed')}
                  >
                    ✓ Printed ({customerGroups.length - unprintedFoldersCount})
                  </button>
                </div>

                <div className="flex items-center gap-2" style={{ maxWidth: '380px', width: '100%', justifyContent: 'flex-end' }}>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="🔍 Search customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '0.82rem', flex: 1 }}
                  />
                  {onCreateShopFolder && (
                    <button
                      className="btn btn-primary btn-sm new-folder-btn"
                      onClick={() => setShowCreateFolderModal(true)}
                      style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      ➕ New Folder
                    </button>
                  )}
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
            </>
          )}
        </div>
      )}


      {/* ── Create Folder Modal ── */}
      {showCreateFolderModal && (
        <div className="rename-modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
          <motion.div
            className="rename-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge">🗂️</div>
              <div>
                <h3 className="rename-modal-title">New Folder Create Karo</h3>
                <p className="rename-modal-sub">Apni files organize karne ke liye custom folder</p>
              </div>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="rename-modal-body">
                <label className="rename-input-label">Folder ka Naam *</label>
                <input
                  type="text"
                  className="input rename-text-input"
                  placeholder="e.g. Passport Photos, ID Cards, Documents..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  maxLength={80}
                />
                <label className="rename-input-label" style={{ marginTop: '10px' }}>Description (optional)</label>
                <input
                  type="text"
                  className="input rename-text-input"
                  placeholder="e.g. All passport size photos from today..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  maxLength={200}
                />
                {createFolderError && (
                  <p style={{ color: '#DC2626', fontSize: '0.78rem', margin: '6px 0 0', fontWeight: 600 }}>
                    ❌ {createFolderError}
                  </p>
                )}
              </div>
              <div className="rename-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost rename-btn"
                  onClick={() => { setShowCreateFolderModal(false); setCreateFolderError(''); setNewFolderName(''); setNewFolderDesc(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rename-btn"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                >
                  {isCreatingFolder ? '⏳ Creating...' : '🗂️ Folder Banao'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Rename Shop Folder Modal ── */}
      {editingShopFolder && (

        <div className="rename-modal-overlay" onClick={() => setEditingShopFolder(null)}>
          <motion.div
            className="rename-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge">✏️</div>
              <div>
                <h3 className="rename-modal-title">Folder Rename Karo</h3>
                <p className="rename-modal-sub">Naya naam ya description daalo</p>
              </div>
            </div>
            <form onSubmit={handleRenameShopFolder}>
              <div className="rename-modal-body">
                <label className="rename-input-label">Folder Name *</label>
                <input
                  type="text"
                  className="input rename-text-input"
                  placeholder="Folder name..."
                  value={renameShopFolderName}
                  onChange={(e) => setRenameShopFolderName(e.target.value)}
                  autoFocus
                  maxLength={80}
                />
                <label className="rename-input-label" style={{ marginTop: '10px' }}>Description (optional)</label>
                <input
                  type="text"
                  className="input rename-text-input"
                  placeholder="Description..."
                  value={renameShopFolderDesc}
                  onChange={(e) => setRenameShopFolderDesc(e.target.value)}
                  maxLength={200}
                />
                {renameShopFolderError && (
                  <p style={{ color: '#DC2626', fontSize: '0.78rem', margin: '6px 0 0', fontWeight: 600 }}>
                    ❌ {renameShopFolderError}
                  </p>
                )}
              </div>
              <div className="rename-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost rename-btn"
                  onClick={() => { setEditingShopFolder(null); setRenameShopFolderError(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rename-btn"
                  disabled={isRenamingShopFolder || !renameShopFolderName.trim()}
                >
                  {isRenamingShopFolder ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Shop Folder Delete Confirm ── */}

      {shopFolderDeleteConfirm && (
        <div className="rename-modal-overlay" onClick={() => setShopFolderDeleteConfirm(null)}>
          <motion.div
            className="rename-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge" style={{ background: '#FEE2E2', borderColor: '#FECACA' }}>🗑️</div>
              <div>
                <h3 className="rename-modal-title" style={{ color: '#DC2626' }}>Folder Delete Karo?</h3>
                <p className="rename-modal-sub">{shopFolderDeleteConfirm.folderName}</p>
              </div>
            </div>
            <div className="rename-modal-body">
              <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
                ⚠️ Folder delete hoga — files delete nahi hongi, sirf folder hata diya jaega.
              </p>
            </div>
            <div className="rename-modal-actions">
              <button
                type="button"
                className="btn btn-ghost rename-btn"
                onClick={() => setShopFolderDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger rename-btn"
                onClick={handleDeleteShopFolder}
                disabled={isDeletingShopFolder}
              >
                {isDeletingShopFolder ? '⏳ Deleting...' : '🗑️ Haan, Delete Karo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* ── Single File Move / Copy Modal ── */}
      {moveCopyTargetFile && (
        <div className="rename-modal-overlay" onClick={() => setMoveCopyTargetFile(null)}>
          <motion.div
            className="rename-modal"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge" style={{ background: '#EEF2FF', borderColor: '#C7D2FE' }}>📂</div>
              <div style={{ minWidth: 0 }}>
                <h3 className="rename-modal-title">Move / Copy File</h3>
                <p className="rename-modal-sub" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={moveCopyTargetFile.originalName}>
                  {moveCopyTargetFile.originalName || moveCopyTargetFile.name || 'File'}
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteMoveCopy}>
              <div className="rename-modal-body" style={{ gap: '14px' }}>
                <div>
                  <label className="rename-input-label">Action Select Karo</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${moveCopyMode === 'move' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setMoveCopyMode('move')}
                    >
                      🚚 Move (स्थान परिवर्तन)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${moveCopyMode === 'copy' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setMoveCopyMode('copy')}
                    >
                      📋 Copy (प्रतिलिपि)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="rename-input-label" style={{ marginBottom: '6px' }}>Target Folder Chuno *</label>
                  <FolderPicker
                    shopFolders={shopFolders}
                    customerGroups={customerGroups}
                    files={files}
                    selectedFolderId={destFolderId}
                    onSelectFolder={(id) => setDestFolderId(id)}
                    onCreateFolder={onCreateShopFolder}
                  />


                </div>


                {moveCopyError && (
                  <p style={{ color: '#DC2626', fontSize: '0.78rem', margin: '4px 0 0', fontWeight: 600 }}>
                    ❌ {moveCopyError}
                  </p>
                )}
              </div>

              <div className="rename-modal-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-ghost rename-btn"
                  onClick={() => setMoveCopyTargetFile(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rename-btn"
                  disabled={isProcessingMoveCopy}
                >
                  {isProcessingMoveCopy
                    ? '⏳ Processing...'
                    : moveCopyMode === 'move'
                    ? '🚚 Move File'
                    : '📋 Copy File'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Bulk Actions Modal (Move / Copy / Delete Selected Files) ── */}
      {bulkActionModal && (
        <div className="rename-modal-overlay" onClick={() => setBulkActionModal(null)}>
          <motion.div
            className="rename-modal"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
          >
            <div className="rename-modal-header">
              <div className="rename-icon-badge" style={{
                background: bulkActionModal === 'delete' ? '#FEE2E2' : '#EEF2FF',
                borderColor: bulkActionModal === 'delete' ? '#FECACA' : '#C7D2FE'
              }}>
                {bulkActionModal === 'move' ? '🚚' : bulkActionModal === 'copy' ? '📋' : '🗑️'}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="rename-modal-title" style={{
                  color: bulkActionModal === 'delete' ? '#DC2626' : undefined
                }}>
                  {bulkActionModal === 'move' ? 'Bulk Move Files' : bulkActionModal === 'copy' ? 'Bulk Copy Files' : 'Bulk Delete Files'}
                </h3>
                <p className="rename-modal-sub">
                  {selectedFileIds.size} files selected for {bulkActionModal}
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleExecuteBulkAction(); }}>
              <div className="rename-modal-body" style={{ gap: '14px' }}>
                {bulkActionModal === 'delete' ? (
                  <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                    ⚠️ Kya aap sach me select ki gayi <strong>{selectedFileIds.size} files</strong> ko delete karna chahte hain? Yeh action undone nahi ho sakta.
                  </p>
                ) : (
                  <div>
                    <label className="rename-input-label" style={{ marginBottom: '6px' }}>Target Folder Chuno *</label>
                    <FolderPicker
                      shopFolders={shopFolders}
                      customerGroups={customerGroups}
                      files={files}
                      selectedFolderId={destFolderId}
                      onSelectFolder={(id) => setDestFolderId(id)}
                      onCreateFolder={onCreateShopFolder}
                    />


                  </div>

                )}

                {moveCopyError && (
                  <p style={{ color: '#DC2626', fontSize: '0.78rem', margin: '4px 0 0', fontWeight: 600 }}>
                    ❌ {moveCopyError}
                  </p>
                )}
              </div>

              <div className="rename-modal-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-ghost rename-btn"
                  onClick={() => setBulkActionModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn rename-btn ${bulkActionModal === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={isProcessingMoveCopy}
                >
                  {isProcessingMoveCopy
                    ? '⏳ Processing...'
                    : bulkActionModal === 'move'
                    ? `🚚 Move (${selectedFileIds.size})`
                    : bulkActionModal === 'copy'
                    ? `📋 Copy (${selectedFileIds.size})`
                    : `🗑️ Delete (${selectedFileIds.size})`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Floating Sticky Bulk Action Bar ── */}
      <AnimatePresence>
        {selectedFileIds.size > 0 && (
          <motion.div
            className="bulk-floating-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bulk-bar-content">
              <span className="bulk-badge">☑️ {selectedFileIds.size} Selected</span>
              <div className="bulk-bar-buttons">
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: '#4F46E5' }}
                  onClick={() => { setBulkActionModal('move'); setDestFolderId(''); setMoveCopyError(''); }}
                >
                  🚚 Move
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setBulkActionModal('copy'); setDestFolderId(''); setMoveCopyError(''); }}
                >
                  📋 Copy
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => { setBulkActionModal('delete'); setMoveCopyError(''); }}
                >
                  🗑️ Delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#64748B' }}
                  onClick={handleClearSelection}
                  title="Clear Selection"
                >
                  ✕ Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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

      {/* ── Shop Folder QR Modal ── */}
      {qrModalShopFolder && (
        <QRModal
          isOpen={Boolean(qrModalShopFolder)}
          onClose={() => setQrModalShopFolder(null)}
          shopId={shop?.shopId || 'default'}
          shopName={shop?.shopName || 'WiFi Drop'}
          folderId={qrModalShopFolder.folderId}
          folderName={qrModalShopFolder.folderName}
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
        .new-folder-btn {
          white-space: nowrap;
          flex-shrink: 0;
        }

        .shop-folders-section {
          background: linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%);
          border: 1.5px solid #C7D2FE;
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.25rem 1rem;
          margin-bottom: 0.5rem;
        }

        .shop-folders-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .shop-folders-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #312E81;
          margin: 0;
        }

        .shop-folders-count {
          background: #4F46E5;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 1px 8px;
          border-radius: 9999px;
        }

        .shop-folder-card {
          border: 1.5px solid #C7D2FE !important;
          background: linear-gradient(145deg, #ffffff, #F5F3FF) !important;
        }

        .shop-folder-card:hover {
          border-color: #4F46E5 !important;
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.18) !important;
        }

        .shop-folder-badge-tag {
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .shop-folder-workspace {
          margin-bottom: 1.5rem;
        }

        .folder-upload-progress {
          background: #E2E8F0;
          border-radius: 9999px;
          height: 8px;
          margin: 12px 0;
          overflow: hidden;
          position: relative;
        }

        .folder-upload-bar {
          background: linear-gradient(90deg, #4F46E5, #7C3AED);
          height: 100%;
          border-radius: 9999px;
          transition: width 0.3s ease;
        }

        .folder-upload-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          margin: 8px 0;
        }

        .folder-upload-success {
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          color: #15803D;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 700;
          margin: 8px 0;
        }

        .folder-upload-inline-btn {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .shop-folder-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1rem;
          text-align: center;
          color: var(--text-muted);
          gap: 4px;
        }

        .shop-folder-empty p {
          font-size: 0.84rem;
          font-weight: 600;
          margin: 0;
        }

        .workspace-sub {
          font-size: 0.78rem;
          color: #64748B;
          margin: 2px 0 0;
        }

        .create-folder-cta {
          background: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%);
          border: 1.5px dashed #A5B4FC;
          border-radius: var(--radius-xl);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 1rem;
        }

        /* ── Main Tab Switcher ── */
        .main-tab-switcher {
          display: flex;
          gap: 6px;
          background: #F1F5F9;
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 1.25rem;
          width: fit-content;
        }

        .main-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-size: 0.86rem;
          font-weight: 700;
          color: #64748B;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .main-tab-btn:hover {
          background: #E2E8F0;
          color: #334155;
        }

        .main-tab-btn.active {
          background: #FFFFFF;
          color: #1E293B;
          box-shadow: 0 1px 6px rgba(0,0,0,0.10);
        }

        .main-tab-count {
          background: #E2E8F0;
          color: #475569;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 1px 8px;
          border-radius: 9999px;
          min-width: 22px;
          text-align: center;
        }

        .main-tab-btn.active .main-tab-count {
          background: #EEF2FF;
          color: #4F46E5;
        }

        .shop-tab-count {
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          color: #fff;
        }

        .main-tab-btn.active .shop-tab-count {
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          color: #fff;
        }

        @media (max-width: 480px) {
          .main-tab-switcher {
            width: 100%;
          }
          .main-tab-btn {
            flex: 1;
            justify-content: center;
            padding: 8px 8px;
            font-size: 0.78rem;
          }
        }

        /* ── Floating Sticky Bulk Action Bar ── */
        .bulk-floating-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
          padding: 8px 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }

        .bulk-bar-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .bulk-badge {
          color: #F8FAFC;
          font-weight: 700;
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .bulk-bar-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>

    </div>
  );
}
