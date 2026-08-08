/**
 * client/src/pages/dashboard/BillingPage.jsx
 * Page: Billing & Invoicing — Auto-imports shared print files into customer bills
 * Calculates total dynamically: Pages (Qty) × Price Per Page (Rate) + GST
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../../config';
import {
  getPendingBillItems,
  removePendingBillItem,
  clearPendingBillForCustomer,
} from '../../utils/billManager';

const SERVICES = [
  { name: 'B&W Print (per page)', rate: 2 },
  { name: 'Color Print (per page)', rate: 10 },
  { name: 'Scanning (per page)', rate: 5 },
  { name: 'Lamination (A4)', rate: 30 },
  { name: 'Spiral Binding', rate: 40 },
  { name: 'Photo Print 4×6', rate: 15 },
  { name: 'Xerox (per page)', rate: 2 },
  { name: 'ID Card Print', rate: 50 },
];

function generateInvoiceNo() {
  return `INV-${Date.now().toString().slice(-6)}`;
}

export function BillingPage({ files, texts, shop }) {
  const [activeTab, setActiveTab] = useState('quick_bill');
  const [customer, setCustomer] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [includeGst, setIncludeGst] = useState(true);
  const [items, setItems] = useState([]);
  const [pendingBillQueue, setPendingBillQueue] = useState(() => getPendingBillItems());
  const [invoices, setInvoices] = useState([]);
  const [, setLoading] = useState(true);

  const shopId = shop?.shopId || 'default';

  // Sync pending bill items from storage & listen for live events
  const refreshPendingQueue = useCallback(() => {
    setPendingBillQueue(getPendingBillItems());
  }, []);

  useEffect(() => {
    refreshPendingQueue();
    window.addEventListener('wifidrop_bill_items_updated', refreshPendingQueue);
    return () => window.removeEventListener('wifidrop_bill_items_updated', refreshPendingQueue);
  }, [refreshPendingQueue]);

  // Fetch real invoices from backend on mount
  useEffect(() => {
    fetchInvoices();
  }, [shopId]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await axios.get(`${config.serverUrl}/api/invoices?shopId=${shopId}`);
      if (res.data.success) {
        setInvoices(res.data.invoices || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  // Unique customers list from files, texts, and pending bill queue
  const uniqueCustomers = useMemo(() => {
    const names = new Set();
    pendingBillQueue.forEach((item) => names.add(item.customerName));
    files.forEach((f) => { if (f.customerName || f.deviceName) names.add(f.customerName || f.deviceName); });
    texts.forEach((t) => { if (t.customerName || t.deviceName) names.add(t.customerName || t.deviceName); });
    return Array.from(names);
  }, [pendingBillQueue, files, texts]);

  // Customers who have pending files in bill queue
  const pendingCustomers = useMemo(() => {
    const map = {};
    pendingBillQueue.forEach((item) => {
      const name = item.customerName || 'Anonymous';
      if (!map[name]) map[name] = [];
      map[name].push(item);
    });
    return Object.entries(map).map(([name, itemList]) => ({ name, count: itemList.length, items: itemList }));
  }, [pendingBillQueue]);

  // When customer is selected, load their pending shared files into bill items table!
  const loadCustomerPendingItems = useCallback((targetCustomerName) => {
    const targetName = targetCustomerName.trim().toLowerCase();
    if (!targetName) return;

    const matchedPending = pendingBillQueue.filter(
      (i) => (i.customerName || '').toLowerCase().trim() === targetName
    );

    if (matchedPending.length > 0) {
      const convertedItems = matchedPending.map((p) => ({
        id: p.id,
        fileId: p.fileId,
        service: p.fileName ? `Print: ${p.fileName}` : p.service || 'B&W Print (per page)',
        qty: p.pages || 1, // Pages count
        rate: p.rate || 2, // Per page rate
        isSharedFile: true,
      }));
      setItems(convertedItems);
    }
  }, [pendingBillQueue]);

  function handleSelectCustomer(name) {
    setCustomer(name);
    loadCustomerPendingItems(name);
  }

  const subtotal = items.reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const gst = includeGst ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  const total = subtotal + gst;

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: `item_${Date.now()}`, service: SERVICES[0].name, qty: 1, rate: SERVICES[0].rate },
    ]);
  }

  function removeItem(idx) {
    const targetItem = items[idx];
    if (targetItem && targetItem.id) {
      removePendingBillItem(targetItem.id);
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: field === 'qty' || field === 'rate' ? Number(value) : value,
      };

      // Auto set default rate if service type is selected from standard list
      if (field === 'service') {
        const stdSvc = SERVICES.find((s) => s.name === value);
        if (stdSvc) next[idx].rate = stdSvc.rate;
      }
      return next;
    });
  }

  async function saveBill() {
    if (!customer.trim()) {
      alert('Please enter or select a customer name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least 1 item to the bill');
      return;
    }

    const inv = {
      no: generateInvoiceNo(),
      shopId,
      customerName: customer.trim(),
      subtotal,
      gst,
      amount: total,
      mode: payMode,
      status: 'paid',
      items: items.map((i) => ({
        service: i.service,
        qty: Number(i.qty) || 1,
        rate: Number(i.rate) || 0,
      })),
    };

    try {
      const res = await axios.post(`${config.serverUrl}/api/invoices`, inv);
      if (res.data.success) {
        setInvoices((prev) => [res.data.invoice, ...prev]);

        // Clear pending bill queue for this customer
        clearPendingBillForCustomer(customer.trim());
        refreshPendingQueue();

        setCustomer('');
        setItems([]);
        setActiveTab('invoices');
      }
    } catch (err) {
      alert('Error saving invoice: ' + (err.response?.data?.error || err.message));
    }
  }

  async function deleteInvoice(idOrNo) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await axios.delete(`${config.serverUrl}/api/invoices/${idOrNo}`);
      setInvoices((prev) => prev.filter((i) => i._id !== idOrNo && i.no !== idOrNo));
    } catch {
      alert('Failed to delete invoice');
    }
  }

  function exportCSV() {
    if (invoices.length === 0) {
      alert('No invoices available to export');
      return;
    }
    const headers = ['Invoice No', 'Date', 'Customer Name', 'Subtotal', 'GST', 'Amount', 'Payment Mode', 'Status'];
    const rows = invoices.map((inv) => [
      inv.no,
      new Date(inv.createdAt || inv.date || Date.now()).toLocaleDateString('en-IN'),
      `"${(inv.customerName || inv.customer || '').replace(/"/g, '""')}"`,
      inv.subtotal || 0,
      inv.gst || 0,
      inv.amount || 0,
      inv.mode || 'cash',
      inv.status || 'paid',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wifidrop_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
  const todayRevenue = invoices
    .filter((i) => i.status === 'paid' && new Date(i.date || i.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  return (
    <div className="billing-page">
      {/* Revenue Stats */}
      <div className="billing-stats">
        {[
          { label: 'Today Revenue', value: `₹${todayRevenue.toLocaleString('en-IN')}`, color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: '#059669', bg: '#ECFDF5' },
          { label: 'Total Invoices', value: invoices.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Pending Bills', value: invoices.filter((i) => i.status === 'pending').length, color: '#EF4444', bg: '#FEF2F2' },
        ].map((s) => (
          <div key={s.label} className="billing-stat">
            <div className="billing-stat-val" style={{ color: s.color }}>{s.value}</div>
            <div className="billing-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar & Export Button */}
      <div className="flex items-center justify-between" style={{ width: '100%' }}>
        <div className="billing-tabs">
          <button className={`tab-pill ${activeTab === 'quick_bill' ? 'active' : ''}`} onClick={() => setActiveTab('quick_bill')}>
            💰 Quick Bill & File Charges
          </button>
          <button className={`tab-pill ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
            📋 Invoices ({invoices.length})
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
          📥 Export Sales CSV
        </button>
      </div>

      {/* Pending Customer File Queue Bar */}
      {pendingCustomers.length > 0 && activeTab === 'quick_bill' && (
        <div className="pending-queue-bar">
          <span className="pending-queue-title">💳 Files Added to Bill:</span>
          <div className="pending-queue-chips">
            {pendingCustomers.map((pc) => (
              <button
                key={pc.name}
                className={`pending-chip ${customer === pc.name ? 'active' : ''}`}
                onClick={() => handleSelectCustomer(pc.name)}
              >
                👤 {pc.name} <span className="chip-badge">{pc.count} files</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'quick_bill' && (
          <motion.div key="quickbill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bill-form-card">
              {/* Customer & Payment Mode Selector */}
              <div className="bill-row">
                <div style={{ flex: 1 }}>
                  <label className="form-label">Customer Name / Token</label>
                  <input
                    type="text"
                    className="input"
                    list="cust-list"
                    placeholder="Select customer or type e.g. Ramesh Kumar"
                    value={customer}
                    onChange={(e) => {
                      setCustomer(e.target.value);
                      loadCustomerPendingItems(e.target.value);
                    }}
                  />
                  <datalist id="cust-list">
                    {uniqueCustomers.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div style={{ width: '160px' }}>
                  <label className="form-label">Payment Mode</label>
                  <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    <option value="cash">💵 Cash</option>
                    <option value="upi">📱 UPI / QR</option>
                    <option value="card">💳 Card</option>
                    <option value="credit">📝 Credit</option>
                  </select>
                </div>
              </div>

              {/* Service Items Table */}
              <div className="bill-items-section">
                <div className="bill-items-header">
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
                      📋 File Items & Per Page Pricing
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Set total pages and per page price (₹) for each document
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-xs" onClick={addItem}>
                    + Add Custom Charge
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="empty-bill-box">
                    <span style={{ fontSize: '1.8rem' }}>📄</span>
                    <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#64748B', marginTop: '4px' }}>
                      No items in this bill yet.
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      Click <strong>"💳 Add to Bill"</strong> on any file card or pick a customer above, or click <strong>"+ Add Custom Charge"</strong>.
                    </p>
                  </div>
                ) : (
                  <table className="bill-table">
                    <thead>
                      <tr>
                        <th>File / Service Name</th>
                        <th style={{ width: '100px' }}>Pages (Qty)</th>
                        <th style={{ width: '130px' }}>Price / Page (₹)</th>
                        <th style={{ width: '120px' }}>Total (₹)</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={item.id || i}>
                          <td style={{ minWidth: 0, overflow: 'hidden' }}>
                            <input
                              type="text"
                              className="input input-sm"
                              style={{ minWidth: 0, width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                              placeholder="Service or File name"
                              value={item.service}
                              title={item.service}
                              onChange={(e) => updateItem(i, 'service', e.target.value)}
                            />
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                className="input input-sm"
                                min={1}
                                value={item.qty}
                                onChange={(e) => updateItem(i, 'qty', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>₹</span>
                              <input
                                type="number"
                                className="input input-sm"
                                min={0}
                                step="0.5"
                                value={item.rate}
                                onChange={(e) => updateItem(i, 'rate', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                              ₹{((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <button className="btn-icon btn-danger-icon" onClick={() => removeItem(i)} title="Remove Item">
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals Section */}
              <div className="bill-totals-area">
                <div className="gst-toggle flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gst-check"
                    checked={includeGst}
                    onChange={(e) => setIncludeGst(e.target.checked)}
                  />
                  <label htmlFor="gst-check" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                    Include GST (18%)
                  </label>
                </div>

                <div className="bill-totals">
                  <div className="bill-total-row">
                    <span>Subtotal ({items.length} items)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {includeGst && (
                    <div className="bill-total-row">
                      <span>GST (18%)</span>
                      <span>₹{gst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="bill-total-row grand">
                    <span>💰 Grand Total</span>
                    <span style={{ color: '#4F46E5', fontSize: '1.2rem', fontWeight: 900 }}>
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-4">
                <button className="btn btn-primary" onClick={saveBill} disabled={items.length === 0}>
                  💾 Save & Complete Bill
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={items.length === 0}>
                  🖨️ Print Bill Receipt
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'invoices' && (
          <motion.div key="invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="invoice-table-wrapper">
              {invoices.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">📋</span>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No invoices found</p>
                  <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Create your first bill in the Quick Bill tab.</p>
                </div>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Mode</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv._id || inv.no || i}>
                        <td><code style={{ fontSize: '0.8rem', color: '#4F46E5' }}>{inv.no}</code></td>
                        <td><span style={{ fontWeight: 700 }}>{inv.customerName || inv.customer}</span></td>
                        <td><span style={{ fontWeight: 800, color: '#059669' }}>₹{(inv.amount || 0).toFixed(2)}</span></td>
                        <td><span className="mode-badge">{(inv.mode || 'cash').toUpperCase()}</span></td>
                        <td><span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{new Date(inv.createdAt || inv.date || Date.now()).toLocaleDateString('en-IN')}</span></td>
                        <td>
                          <span className={`status-pill ${inv.status === 'paid' ? 'printed' : 'pending'}`}>
                            {inv.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: '#EF4444' }}
                            onClick={() => deleteInvoice(inv._id || inv.no)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .billing-page { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
        .billing-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .billing-stat { background: white; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .billing-stat-val { font-size: 1.6rem; font-weight: 900; line-height: 1; }
        .billing-stat-lbl { font-size: 0.78rem; color: #64748B; font-weight: 600; margin-top: 4px; }
        .billing-tabs { display: flex; gap: 6px; background: #F1F5F9; padding: 4px; border-radius: 9999px; width: fit-content; }
        .tab-pill { padding: 8px 18px; border-radius: 9999px; border: none; background: transparent; font-size: 0.84rem; font-weight: 600; color: #64748B; cursor: pointer; transition: all 0.18s ease; font-family: var(--font-family); white-space: nowrap; }
        .tab-pill.active { background: white; color: #4F46E5; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .pending-queue-bar { display: flex; align-items: center; gap: 12px; background: #EEF2FF; border: 1px solid #C7D2FE; padding: 10px 16px; border-radius: 14px; }
        .pending-queue-title { font-size: 0.8rem; font-weight: 800; color: #4F46E5; white-space: nowrap; }
        .pending-queue-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .pending-chip { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; border: 1px solid #C7D2FE; background: white; color: #374151; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; font-family: var(--font-family); }
        .pending-chip:hover, .pending-chip.active { background: #4F46E5; color: white; border-color: #4F46E5; }
        .chip-badge { font-size: 0.68rem; background: #F1F5F9; color: #4F46E5; padding: 1px 6px; border-radius: 999px; }
        .pending-chip.active .chip-badge { background: rgba(255,255,255,0.25); color: white; }
        .bill-form-card { background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .bill-row { display: flex; gap: 1rem; margin-bottom: 1.25rem; }
        .bill-items-section { margin-bottom: 1.25rem; }
        .bill-items-header { display: flex; items-center; justify-content: space-between; margin-bottom: 0.75rem; }
        .empty-bill-box { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 14px; padding: 2rem; text-align: center; }
        .bill-table { width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; table-layout: fixed; }
        .bill-table th { background: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bill-table td { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
        .bill-table td input { width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
        .bill-table tr:last-child td { border-bottom: none; }
        .bill-totals-area { display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid #F1F5F9; padding-top: 1.25rem; margin-top: 0.5rem; }
        .bill-totals { display: flex; flex-direction: column; gap: 6px; width: 280px; }
        .bill-total-row { display: flex; justify-content: space-between; font-size: 0.88rem; color: #64748B; font-weight: 600; }
        .bill-total-row.grand { font-size: 1.1rem; font-weight: 900; color: #0F172A; padding-top: 8px; border-top: 2px solid #E2E8F0; margin-top: 4px; }
        .invoice-table-wrapper { background: white; border: 1px solid #E2E8F0; border-radius: 18px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th { background: #F8FAFC; padding: 12px 16px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #E2E8F0; }
        .print-table td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .print-table tr:last-child td { border-bottom: none; }
        .print-table tr:hover td { background: #F8FAFC; }
        .mode-badge { font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: #F1F5F9; color: #374151; }
        .status-pill { font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
        .status-pill.printed { background: #ECFDF5; color: #059669; }
        .status-pill.pending { background: #FFFBEB; color: #D97706; }
        .mt-4 { margin-top: 1rem; }
      `}</style>
    </div>
  );
}
