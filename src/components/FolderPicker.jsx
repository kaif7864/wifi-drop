/**
 * client/src/components/FolderPicker.jsx
 * Searchable & Filterable Target Folder Selector for Move / Copy operations.
 * Supports both Shop Folders and Customer Folders with real-time Search.
 */

import { useState, useMemo } from 'react';

function normalizeCustomerId(file) {
  if (file.customerId && file.customerId.trim()) return file.customerId.trim();
  if (file.customerName && file.customerName.trim()) return `cust_${file.customerName.trim().toLowerCase().replace(/\s+/g, '_')}`;
  return 'cust_guest';
}

export function FolderPicker({
  shopFolders = [],
  customerGroups = null,
  files = [],
  selectedFolderId,
  onSelectFolder,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'shop' | 'customer'

  // Derive customer list if customerGroups is not passed directly
  const computedCustomerGroups = useMemo(() => {
    if (Array.isArray(customerGroups)) return customerGroups;

    const groups = {};
    (files || []).forEach((file) => {
      const custId = normalizeCustomerId(file);
      if (!groups[custId]) {
        groups[custId] = {
          customerId: custId,
          customerName: file.customerName || null,
          deviceName: file.deviceName || 'Customer Mobile',
          files: [],
        };
      }
      groups[custId].files.push(file);
      if (file.customerName && file.customerName.trim()) {
        groups[custId].customerName = file.customerName.trim();
      }
    });

    return Object.values(groups);
  }, [customerGroups, files]);

  // Standardize customer list
  const customerFoldersList = useMemo(() => {
    return (computedCustomerGroups || []).map((c) => {
      const displayName = c.nickname || c.customerName || c.deviceName || c.customerId;
      return {
        id: c.customerId,
        type: 'customer',
        name: displayName,
        sub: `Customer Folder · ${c.files ? c.files.length : 0} files`,
        icon: '👤',
        raw: c,
      };
    });
  }, [computedCustomerGroups]);

  // Standardize shop folder list
  const shopFoldersList = useMemo(() => {
    return (shopFolders || []).map((f) => {
      const count = (files || []).filter((item) => item.folderId === f.folderId).length;
      return {
        id: f.folderId,
        type: 'shop',
        name: f.folderName,
        sub: `Shop Folder · ${count} files · ID: ${f.folderId}`,
        icon: '🗂️',
        raw: f,
      };
    });
  }, [shopFolders, files]);


  // Combine all destinations
  const allDestinations = useMemo(() => {
    const list = [];

    if (filterType === 'all' || filterType === 'shop') {
      list.push(...shopFoldersList);
    }
    if (filterType === 'all' || filterType === 'customer') {
      list.push(...customerFoldersList);
    }

    if (!searchQuery || !searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (item.sub && item.sub.toLowerCase().includes(q)) ||
      (item.id && item.id.toLowerCase().includes(q))
    );
  }, [shopFoldersList, customerFoldersList, filterType, searchQuery]);

  return (
    <div className="folder-picker-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Search Input Bar */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="rename-text-input"
          placeholder="🔍 Search folder by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            paddingLeft: '36px',
            fontSize: '0.86rem',
            height: '42px',
          }}
        />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>
          🔍
        </span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          className={`btn btn-xs ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilterType('all')}
          style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '8px' }}
        >
          All ({shopFoldersList.length + customerFoldersList.length})
        </button>

        <button
          type="button"
          className={`btn btn-xs ${filterType === 'shop' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilterType('shop')}
          style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '8px' }}
        >
          🗂️ Shop ({shopFoldersList.length})
        </button>
        <button
          type="button"
          className={`btn btn-xs ${filterType === 'customer' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilterType('customer')}
          style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '8px' }}
        >
          👤 Customer ({customerFoldersList.length})
        </button>
      </div>

      {/* Scrollable Destinations List */}
      <div
        className="folder-picker-list"
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1.5px solid #E2E8F0',
          borderRadius: '12px',
          background: '#FAFAFA',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {allDestinations.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
            No matching folders found for "{searchQuery}"
          </div>
        ) : (
          allDestinations.map((item) => {
            const isSelected = selectedFolderId === item.id;
            return (
              <div
                key={item.id || 'root'}
                onClick={() => onSelectFolder(item.id, item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isSelected ? '#EEF2FF' : '#FFFFFF',
                  border: isSelected ? '1.5px solid #4F46E5' : '1px solid #F1F5F9',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748B' }}>
                    {item.sub}
                  </p>
                </div>
                {isSelected && (
                  <span style={{ color: '#4F46E5', fontWeight: 'bold', fontSize: '1rem' }}>✓</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
