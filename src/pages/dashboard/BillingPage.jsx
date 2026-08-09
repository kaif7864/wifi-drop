/**
 * client/src/pages/dashboard/BillingPage.jsx
 * Multi-Tenant Billing & Invoicing POS System — Fully Mobile Responsive with Touch POS Cards & Invoices
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
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

export function BillingPage({ files = [], texts = [], shop, sessionId }) {
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

  // Load past invoices on mount
  useEffect(() => {
    fetchInvoices();
  }, [shopId]);

  async function fetchInvoices() {
    try {
      setLoading(true);
      const res = await axios.get(`${config.serverUrl}/api/billing/invoices?shopId=${shopId}`);
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
    (pendingBillQueue || []).forEach((item) => { if (item?.customerName) names.add(item.customerName); });
    (files || []).forEach((f) => { if (f?.customerName || f?.deviceName) names.add(f.customerName || f.deviceName); });
    (texts || []).forEach((t) => { if (t?.customerName || t?.deviceName) names.add(t.customerName || t.deviceName); });
    return Array.from(names);
  }, [pendingBillQueue, files, texts]);

  // Customers who have pending files in bill queue
  const pendingCustomers = useMemo(() => {
    const map = {};
    (pendingBillQueue || []).forEach((item) => {
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

    const matchedPending = (pendingBillQueue || []).filter(
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

      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id || i.fileId));
        const newOnes = convertedItems.filter((c) => !existingIds.has(c.id) && !existingIds.has(c.fileId));
        return [...prev, ...newOnes];
      });
    }
  }, [pendingBillQueue]);

  const handleSelectCustomer = (custName) => {
    setCustomer(custName);
    loadCustomerPendingItems(custName);
  };

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

      if (field === 'service') {
        const stdSvc = SERVICES.find((s) => s.name === value);
        if (stdSvc) next[idx].rate = stdSvc.rate;
      }
      return next;
    });
  }

  function stepQty(idx, delta) {
    setItems((prev) => {
      const next = [...prev];
      const currentQty = Number(next[idx].qty) || 1;
      const newQty = Math.max(1, currentQty + delta);
      next[idx] = { ...next[idx], qty: newQty };
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
      const res = await axios.post(`${config.serverUrl}/api/billing/invoices`, inv);
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
      await axios.delete(`${config.serverUrl}/api/billing/invoices/${idOrNo}`);
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
          { label: 'Today Revenue', value: `₹${todayRevenue.toLocaleString('en-IN')}`, color: '#4F46E5' },
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: '#059669' },
          { label: 'Total Invoices', value: invoices.length, color: '#D97706' },
          { label: 'Pending Files', value: pendingBillQueue.length, color: '#EF4444' },
        ].map((s) => (
          <div key={s.label} className="billing-stat">
            <div className="billing-stat-val" style={{ color: s.color }}>{s.value}</div>
            <div className="billing-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar & Export Button */}
      <div className="billing-nav-row flex items-center justify-between">
        <div className="billing-tabs">
          <button className={`tab-pill ${activeTab === 'quick_bill' ? 'active' : ''}`} onClick={() => setActiveTab('quick_bill')}>
            💰 Quick Bill (POS)
          </button>
          <button className={`tab-pill ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
            📋 Invoices ({invoices.length})
          </button>
        </div>
        <button className="btn btn-secondary btn-sm export-btn" onClick={exportCSV}>
          📥 Export CSV
        </button>
      </div>

      {/* Pending Customer File Queue Bar */}
      {pendingCustomers.length > 0 && activeTab === 'quick_bill' && (
        <div className="pending-queue-bar">
          <span className="pending-queue-title">⚡ Added Files Queue:</span>
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
                <div className="form-group flex-1">
                  <label className="form-label">Customer Name / Token</label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="e.g. Ramesh Kumar or Token #5"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    list="billing-customer-datalist"
                  />
                  <datalist id="billing-customer-datalist">
                    {uniqueCustomers.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="input input-sm" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    <option value="cash">💵 Cash</option>
                    <option value="upi">📱 UPI / QR</option>
                    <option value="card">💳 Card</option>
                    <option value="due">⏳ Due / Credit</option>
                  </select>
                </div>
              </div>

              {/* Bill Items Section */}
              <div className="bill-items-section">
                <div className="bill-items-header flex items-center justify-between">
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                    📦 Bill Items ({items.length})
                  </h4>
                  <button className="btn btn-primary btn-xs" onClick={addItem}>
                    + Add Item
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="empty-bill-box">
                    <span style={{ fontSize: '1.8rem' }}>📄</span>
                    <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#64748B', marginTop: '4px' }}>
                      No items in this bill yet.
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      Click <strong>"Add to Bill"</strong> on file cards or click <strong>"+ Add Item"</strong> above.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ── DESKTOP TABLE VIEW ── */}
                    <div className="bill-table-desktop-wrap">
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
                              <td>
                                <input
                                  type="text"
                                  className="input input-sm"
                                  placeholder="Service or File name"
                                  value={item.service}
                                  title={item.service}
                                  onChange={(e) => updateItem(i, 'service', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="input input-sm"
                                  min={1}
                                  value={item.qty}
                                  onChange={(e) => updateItem(i, 'qty', e.target.value)}
                                />
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
                    </div>

                    {/* ── MOBILE TOUCH POS CARDS VIEW ── */}
                    <div className="bill-items-mobile-list">
                      {items.map((item, i) => (
                        <div key={item.id || i} className="mobile-pos-item-card">
                          <div className="mobile-pos-card-top flex items-center justify-between">
                            <input
                              type="text"
                              className="input input-sm mobile-item-name-input"
                              placeholder="Service or File name"
                              value={item.service}
                              onChange={(e) => updateItem(i, 'service', e.target.value)}
                            />
                            <button className="btn-icon btn-danger-icon mobile-item-del-btn" onClick={() => removeItem(i)}>
                              ✕
                            </button>
                          </div>

                          <div className="mobile-pos-card-bottom flex items-center justify-between">
                            {/* Stepper Controls for Qty */}
                            <div className="mobile-qty-stepper flex items-center gap-1">
                              <span className="stepper-label">Qty:</span>
                              <button className="btn-stepper" onClick={() => stepQty(i, -1)}>−</button>
                              <span className="stepper-val">{item.qty || 1}</span>
                              <button className="btn-stepper" onClick={() => stepQty(i, 1)}>+</button>
                            </div>

                            {/* Rate Input */}
                            <div className="mobile-rate-box flex items-center gap-1">
                              <span className="rate-currency">₹</span>
                              <input
                                type="number"
                                className="input input-sm mobile-rate-input"
                                min={0}
                                step="0.5"
                                value={item.rate}
                                onChange={(e) => updateItem(i, 'rate', e.target.value)}
                              />
                            </div>

                            {/* Line Item Total */}
                            <div className="mobile-item-total">
                              ₹{((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
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
                  <label htmlFor="gst-check" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
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
                    <span style={{ color: '#4F46E5', fontSize: '1.25rem', fontWeight: 900 }}>
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bill-actions-row flex items-center gap-2 mt-4">
                <button className="btn btn-primary btn-save-bill" onClick={saveBill} disabled={items.length === 0}>
                  💾 Save & Complete Bill
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={items.length === 0}>
                  🖨️ Print Receipt
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'invoices' && (
          <motion.div key="invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {invoices.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📋</span>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No invoices found</p>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Create your first bill in the Quick Bill tab.</p>
              </div>
            ) : (
              <>
                {/* ── DESKTOP INVOICE TABLE ── */}
                <div className="invoice-table-wrapper desktop-invoices-only">
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
                </div>

                {/* ── MOBILE INVOICES CARDS ── */}
                <div className="mobile-invoices-list">
                  {invoices.map((inv, i) => (
                    <div key={inv._id || inv.no || i} className="mobile-invoice-card">
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="mobile-inv-no">{inv.no}</code>
                          <h4 className="mobile-inv-cust">{inv.customerName || inv.customer || 'Customer'}</h4>
                        </div>
                        <div className="text-right">
                          <div className="mobile-inv-amount">₹{(inv.amount || 0).toFixed(2)}</div>
                          <span className="mode-badge">{(inv.mode || 'cash').toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="mobile-inv-footer flex items-center justify-between">
                        <span className="mobile-inv-date">
                          {new Date(inv.createdAt || inv.date || Date.now()).toLocaleDateString('en-IN')}
                        </span>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: '#EF4444' }}
                          onClick={() => deleteInvoice(inv._id || inv.no)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .billing-page { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
        .billing-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .billing-stat { background: white; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1rem 1.15rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .billing-stat-val { font-size: 1.5rem; font-weight: 900; line-height: 1; }
        .billing-stat-lbl { font-size: 0.76rem; color: #64748B; font-weight: 600; margin-top: 4px; }
        .billing-nav-row { width: 100%; gap: 10px; }
        .billing-tabs { display: flex; gap: 4px; background: #F1F5F9; padding: 4px; border-radius: 9999px; }
        .tab-pill { padding: 8px 18px; border-radius: 9999px; border: none; background: transparent; font-size: 0.82rem; font-weight: 600; color: #64748B; cursor: pointer; transition: all 0.18s ease; font-family: var(--font-family); white-space: nowrap; }
        .tab-pill.active { background: white; color: #4F46E5; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .pending-queue-bar { display: flex; align-items: center; gap: 10px; background: #EEF2FF; border: 1px solid #C7D2FE; padding: 8px 14px; border-radius: 12px; }
        .pending-queue-title { font-size: 0.78rem; font-weight: 800; color: #4F46E5; white-space: nowrap; }
        .pending-queue-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .pending-chip { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid #C7D2FE; background: white; color: #374151; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; font-family: var(--font-family); }
        .pending-chip:hover, .pending-chip.active { background: #4F46E5; color: white; border-color: #4F46E5; }
        .chip-badge { font-size: 0.65rem; background: #F1F5F9; color: #4F46E5; padding: 1px 5px; border-radius: 999px; }
        .pending-chip.active .chip-badge { background: rgba(255,255,255,0.25); color: white; }
        .bill-form-card { background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .bill-row { display: flex; gap: 1rem; margin-bottom: 1.25rem; }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-label { font-size: 0.78rem; font-weight: 700; color: #374151; }
        .bill-items-section { margin-bottom: 1.25rem; }
        .bill-items-header { margin-bottom: 0.75rem; }
        .empty-bill-box { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 14px; padding: 1.75rem; text-align: center; }
        
        /* Desktop Bill Table */
        .bill-table-desktop-wrap { width: 100%; }
        .bill-table { width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; table-layout: fixed; }
        .bill-table th { background: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; }
        .bill-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .bill-table tr:last-child td { border-bottom: none; }
        
        /* Mobile POS Cards (hidden on desktop) */
        .bill-items-mobile-list { display: none; }

        .bill-totals-area { display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid #F1F5F9; padding-top: 1.25rem; margin-top: 0.5rem; }
        .bill-totals { display: flex; flex-direction: column; gap: 6px; width: 280px; }
        .bill-total-row { display: flex; justify-content: space-between; font-size: 0.88rem; color: #64748B; font-weight: 600; }
        .bill-total-row.grand { font-size: 1.1rem; font-weight: 900; color: #0F172A; padding-top: 8px; border-top: 2px solid #E2E8F0; margin-top: 4px; }
        .invoice-table-wrapper { background: white; border: 1px solid #E2E8F0; border-radius: 18px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th { background: #F8FAFC; padding: 12px 16px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #E2E8F0; }
        .print-table td { padding: 12px 16px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .print-table tr:last-child td { border-bottom: none; }
        .mode-badge { font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: #F1F5F9; color: #374151; display: inline-block; }
        .status-pill { font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
        .status-pill.printed { background: #ECFDF5; color: #059669; }
        .status-pill.pending { background: #FFFBEB; color: #D97706; }
        .mobile-invoices-list { display: none; }
        .mt-4 { margin-top: 1rem; }

        /* ── Mobile Responsive Breakpoints (Zero Scrollbars + Touch POS Cards) ── */
        @media (max-width: 768px) {
          .billing-page { gap: 0.875rem; }
          .billing-stats { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
          .billing-stat { padding: 0.75rem 0.875rem; border-radius: 12px; }
          .billing-stat-val { font-size: 1.25rem; }

          .billing-nav-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }

          .billing-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
            padding: 3px;
            gap: 2px;
          }

          .tab-pill {
            padding: 7px 4px;
            font-size: 11px;
            font-weight: 700;
            text-align: center;
            justify-content: center;
          }

          .export-btn {
            width: 100%;
          }

          .pending-queue-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding: 8px 10px;
          }

          .bill-form-card {
            padding: 1rem 0.875rem;
            border-radius: 14px;
          }

          .bill-row {
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          /* Hide desktop table on mobile, show clean touch cards */
          .bill-table-desktop-wrap { display: none; }
          .bill-items-mobile-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .mobile-pos-item-card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .mobile-item-name-input {
            font-weight: 700;
            background: white !important;
          }

          .mobile-item-del-btn {
            width: 30px;
            height: 30px;
            flex-shrink: 0;
            font-size: 12px;
          }

          .mobile-qty-stepper {
            background: white;
            border: 1px solid #CBD5E1;
            border-radius: 8px;
            padding: 2px 4px;
          }

          .stepper-label {
            font-size: 11px;
            font-weight: 700;
            color: #64748B;
            margin-right: 2px;
          }

          .btn-stepper {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            border: none;
            background: #EEF2FF;
            color: #4F46E5;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .stepper-val {
            font-size: 12px;
            font-weight: 800;
            color: #0F172A;
            min-width: 18px;
            text-align: center;
          }

          .mobile-rate-input {
            width: 55px !important;
            padding: 4px 6px !important;
            text-align: center;
            font-weight: 700;
          }

          .rate-currency {
            font-size: 11px;
            font-weight: 800;
            color: #64748B;
          }

          .mobile-item-total {
            font-size: 1rem;
            font-weight: 900;
            color: #059669;
          }

          .bill-totals-area {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .bill-totals {
            width: 100%;
          }

          .bill-actions-row {
            flex-direction: column;
            gap: 6px;
          }

          .btn-save-bill, .bill-actions-row .btn {
            width: 100%;
          }

          /* Invoices Mobile Cards */
          .desktop-invoices-only { display: none; }
          .mobile-invoices-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .mobile-invoice-card {
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 10px 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .mobile-inv-no {
            font-size: 11px;
            font-weight: 700;
            color: #4F46E5;
          }

          .mobile-inv-cust {
            font-size: 0.88rem;
            font-weight: 800;
            color: #0F172A;
            margin-top: 1px;
          }

          .mobile-inv-amount {
            font-size: 1.1rem;
            font-weight: 900;
            color: #059669;
          }

          .mobile-inv-footer {
            padding-top: 6px;
            border-top: 1px solid #F1F5F9;
          }

          .mobile-inv-date {
            font-size: 11px;
            color: #94A3B8;
            font-weight: 600;
          }
        }
      `}</style>
    </div>
  );
}
