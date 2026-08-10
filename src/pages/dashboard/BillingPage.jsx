/**
 * client/src/pages/dashboard/BillingPage.jsx
 * Multi-Tenant Billing & Invoicing POS System — Fully Mobile Responsive with Touch POS Cards & Invoices
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { config } from '../../config';
import { toast } from '../../context/ToastContext';
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

function BillingCustomerSelect({
  value,
  onChange,
  onSelectCustomer,
  customers = [],
  pendingCustomers = [],
  placeholder = 'Select or enter customer...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Combine unique customer names & pending counts
  const customerList = useMemo(() => {
    const map = new Map();
    (customers || []).forEach((name) => {
      if (name && name.trim()) {
        map.set(name.trim(), { name: name.trim(), count: 0 });
      }
    });
    (pendingCustomers || []).forEach((pc) => {
      if (pc?.name) {
        const entry = map.get(pc.name) || { name: pc.name, count: 0 };
        entry.count = pc.count || 0;
        map.set(pc.name, entry);
      }
    });
    return Array.from(map.values());
  }, [customers, pendingCustomers]);

  // Filtered by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customerList;
    return customerList.filter((c) => c.name.toLowerCase().includes(q));
  }, [customerList, search]);

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q && customerList.some((c) => c.name.toLowerCase() === q);
  }, [customerList, search]);

  return (
    <div className="custom-combobox-wrapper">
      {/* Trigger Input Button */}
      <div
        className="custom-combobox-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="combobox-icon">👤</span>
          <span className={`combobox-val ${!value ? 'placeholder' : ''}`}>
            {value || placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {value && (
            <button
              type="button"
              className="combobox-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              title="Clear"
            >
              ✕
            </button>
          )}
          <span className="combobox-chevron">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Floating Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="combobox-backdrop" onClick={() => setIsOpen(false)} />
            <motion.div
              className="combobox-dropdown"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {/* Search Bar */}
              <div className="combobox-search-box">
                <span className="combobox-search-icon">🔍</span>
                <input
                  type="text"
                  className="combobox-search-input"
                  placeholder="Search customer or type new..."
                  value={search}
                  autoFocus
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && search.trim()) {
                      e.preventDefault();
                      onChange(search.trim());
                      if (onSelectCustomer) onSelectCustomer(search.trim());
                      setIsOpen(false);
                    }
                  }}
                />
                {search && (
                  <button
                    type="button"
                    className="combobox-search-clear"
                    onClick={() => setSearch('')}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* List */}
              <div className="combobox-list-container">
                {/* Option to create custom if searched */}
                {search.trim() && !exactMatch && (
                  <div
                    className="combobox-item custom-create-item"
                    onClick={() => {
                      onChange(search.trim());
                      if (onSelectCustomer) onSelectCustomer(search.trim());
                      setIsOpen(false);
                    }}
                  >
                    <span className="combobox-item-avatar custom">✨</span>
                    <div className="combobox-item-info">
                      <span className="combobox-item-name">Use: <strong>"{search.trim()}"</strong></span>
                      <span className="combobox-item-sub">Custom Walk-in Customer</span>
                    </div>
                  </div>
                )}

                {/* Filtered list */}
                {filtered.map((c) => (
                  <div
                    key={c.name}
                    className={`combobox-item ${value === c.name ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(c.name);
                      if (onSelectCustomer) onSelectCustomer(c.name);
                      setIsOpen(false);
                    }}
                  >
                    <span className="combobox-item-avatar">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="combobox-item-info">
                      <span className="combobox-item-name">{c.name}</span>
                      {c.count > 0 ? (
                        <span className="combobox-item-badge">⚡ {c.count} files in queue</span>
                      ) : (
                        <span className="combobox-item-sub">Customer</span>
                      )}
                    </div>
                    {value === c.name && <span className="combobox-check">✓</span>}
                  </div>
                ))}

                {filtered.length === 0 && !search.trim() && (
                  <div className="combobox-empty-msg">
                    No recent customers found. Type a name to create.
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [receiptToPrint, setReceiptToPrint] = useState(null);

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

  // When customer is selected, load ONLY their pending shared files into bill items table!
  const loadCustomerPendingItems = useCallback((targetCustomerName) => {
    const targetName = (targetCustomerName || '').trim().toLowerCase();
    if (!targetName) {
      setItems([]);
      return;
    }

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
      setItems(convertedItems);
    } else {
      // If customer has no pending files, clear previous customer files
      setItems([]);
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
      toast.warning('Please enter or select a customer name');
      return;
    }
    if (items.length === 0) {
      toast.warning('Please add at least 1 item to the bill');
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
      toast.error('Error saving invoice: ' + (err.response?.data?.error || err.message));
    }
  }

  function printCurrentBill() {
    if (items.length === 0) {
      toast.warning('Please add at least one item to print receipt');
      return;
    }
    const receiptData = {
      invoiceNo: generateInvoiceNo(),
      date: new Date().toISOString(),
      shopName: shop?.shopName || 'Shop Counter POS',
      shopPhone: shop?.phone || shop?.mobile || '',
      customerName: customer.trim() || 'Walk-in Customer',
      payMode: payMode,
      items: items.map((it) => ({
        service: it.service || 'Print / Service Item',
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
        total: (Number(it.qty) || 1) * (Number(it.rate) || 0),
      })),
      subtotal: subtotal,
      gst: includeGst ? gst : 0,
      amount: total,
      status: payMode === 'due' ? 'due' : 'paid',
    };
    triggerThermalPrint(receiptData);
  }

  function printCurrentBillA4() {
    if (items.length === 0) {
      toast.warning('Please add at least one item to print invoice');
      return;
    }
    const receiptData = {
      invoiceNo: generateInvoiceNo(),
      date: new Date().toISOString(),
      shopName: shop?.shopName || 'Shop Counter POS',
      shopPhone: shop?.phone || shop?.mobile || '',
      customerName: customer.trim() || 'Walk-in Customer',
      payMode: payMode,
      items: items.map((it) => ({
        service: it.service || 'Print / Service Item',
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
        total: (Number(it.qty) || 1) * (Number(it.rate) || 0),
      })),
      subtotal: subtotal,
      gst: includeGst ? gst : 0,
      amount: total,
      status: payMode === 'due' ? 'due' : 'paid',
    };
    triggerA4InvoicePrint(receiptData);
  }

  function printPastInvoice(inv) {
    const receiptData = {
      invoiceNo: inv.no || `INV-${(inv._id || '').slice(-6)}`,
      date: inv.createdAt || inv.date || new Date().toISOString(),
      shopName: shop?.shopName || 'Shop Counter POS',
      shopPhone: shop?.phone || shop?.mobile || '',
      customerName: inv.customerName || inv.customer || 'Walk-in Customer',
      payMode: inv.mode || 'Cash',
      items: Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [
        { service: 'Counter Service / Print Order', qty: 1, rate: inv.amount || 0, total: inv.amount || 0 }
      ],
      subtotal: inv.subtotal || inv.amount || 0,
      gst: inv.gst || 0,
      amount: inv.amount || 0,
      status: inv.status || 'paid',
    };
    triggerThermalPrint(receiptData);
  }

  function printPastInvoiceA4(inv) {
    const receiptData = {
      invoiceNo: inv.no || `INV-${(inv._id || '').slice(-6)}`,
      date: inv.createdAt || inv.date || new Date().toISOString(),
      shopName: shop?.shopName || 'Shop Counter POS',
      shopPhone: shop?.phone || shop?.mobile || '',
      customerName: inv.customerName || inv.customer || 'Walk-in Customer',
      payMode: inv.mode || 'Cash',
      items: Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [
        { service: 'Counter Service / Print Order', qty: 1, rate: inv.amount || 0, total: inv.amount || 0 }
      ],
      subtotal: inv.subtotal || inv.amount || 0,
      gst: inv.gst || 0,
      amount: inv.amount || 0,
      status: inv.status || 'paid',
    };
    triggerA4InvoicePrint(receiptData);
  }

  function triggerThermalPrint(receiptData) {
    const itemsHtml = (receiptData.items || []).map((it) => `
      <tr>
        <td style="padding: 3px 0; word-break: break-word;">${it.service || 'Item'}</td>
        <td style="text-align: center; padding: 3px 0;">${it.qty || 1}</td>
        <td style="text-align: right; padding: 3px 0;">${(Number(it.rate) || 0).toFixed(2)}</td>
        <td style="text-align: right; padding: 3px 0;">${((Number(it.qty) || 1) * (Number(it.rate) || 0)).toFixed(2)}</td>
      </tr>
    `).join('');

    const gstHtml = receiptData.gst > 0 ? `
      <div style="display: flex; justify-content: space-between; margin: 2px 0;">
        <span>GST (18%):</span>
        <span>₹${(Number(receiptData.gst) || 0).toFixed(2)}</span>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${receiptData.invoiceNo}</title>
        <style>
          @page {
            size: 80mm 160mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 4mm 5mm;
            width: 74mm;
            max-width: 80mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.35;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .shop-title { font-size: 15px; font-weight: 900; margin: 0; text-transform: uppercase; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 11px; }
          th { border-bottom: 1px dashed #000; padding: 3px 0; font-size: 10px; }
          .grand-total { font-size: 13px; font-weight: 900; }
          .footer { text-align: center; margin-top: 8px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h2 class="shop-title">${receiptData.shopName}</h2>
          ${receiptData.shopPhone ? `<div style="font-size: 11px; margin-top: 2px;">Phone: ${receiptData.shopPhone}</div>` : ''}
          <div style="font-size: 10px; margin-top: 2px;">*** CASH MEMO / RECEIPT ***</div>
        </div>
        <div class="double-divider"></div>
        <div class="row"><span>Bill No:</span> <strong>${receiptData.invoiceNo}</strong></div>
        <div class="row"><span>Date:</span> <span>${new Date(receiptData.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
        <div class="row"><span>Customer:</span> <strong>${receiptData.customerName}</strong></div>
        <div class="row"><span>Payment:</span> <strong>${(receiptData.payMode || 'cash').toUpperCase()}</strong></div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left; width: 46%;">ITEM</th>
              <th style="text-align: center; width: 16%;">QTY</th>
              <th style="text-align: right; width: 18%;">RATE</th>
              <th style="text-align: right; width: 20%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="row">
          <span>Subtotal:</span>
          <span>₹${(Number(receiptData.subtotal) || 0).toFixed(2)}</span>
        </div>
        ${gstHtml}
        <div class="double-divider"></div>
        <div class="row grand-total">
          <span>TOTAL:</span>
          <span>₹${(Number(receiptData.amount) || 0).toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>
        <div class="footer">
          <div style="font-size: 11px; margin-bottom: 2px;">Status: <strong>${receiptData.status === 'due' ? '⚠️ DUE / UNPAID' : '✅ PAID'}</strong></div>
          <div style="font-weight: bold; margin: 4px 0;">*** Thank You! Visit Again ***</div>
          <div style="font-size: 9px; color: #555;">⚡ Powered by WiFiDrop POS</div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=380,height=600,menubar=no,toolbar=no,location=no,status=no');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      setReceiptToPrint(receiptData);
      setTimeout(() => window.print(), 100);
    }
  }

  function triggerA4InvoicePrint(receiptData) {
    const itemsHtml = (receiptData.items || []).map((it, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${it.service || 'Item'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${it.qty || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${(Number(it.rate) || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700;">₹${((Number(it.qty) || 1) * (Number(it.rate) || 0)).toFixed(2)}</td>
      </tr>
    `).join('');

    const gstHtml = receiptData.gst > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #E2E8F0;">
        <span>GST (18%):</span>
        <strong>₹${(Number(receiptData.gst) || 0).toFixed(2)}</strong>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice - ${receiptData.invoiceNo}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            color: #0F172A;
            line-height: 1.5;
          }
          .invoice-card {
            border: 2px solid #E2E8F0;
            border-radius: 12px;
            padding: 24px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px; }
          .shop-title { font-size: 24px; font-weight: 900; color: #4F46E5; margin: 0; }
          .inv-title { font-size: 20px; font-weight: 800; color: #0F172A; text-align: right; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .meta-box { background: #F8FAFC; padding: 12px 16px; border-radius: 8px; border: 1px solid #E2E8F0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #EEF2FF; color: #4F46E5; font-weight: 800; font-size: 13px; text-transform: uppercase; padding: 10px; text-align: left; }
          .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
          .totals-box { width: 300px; }
          .grand-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 900; color: #4F46E5; border-top: 2px solid #4F46E5; }
          .footer { text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="invoice-card">
          <div class="header">
            <div>
              <h1 class="shop-title">${receiptData.shopName}</h1>
              ${receiptData.shopPhone ? `<div style="color: #64748B; font-size: 13px; margin-top: 4px;">Phone: ${receiptData.shopPhone}</div>` : ''}
              <div style="color: #64748B; font-size: 13px;">Document Printing & Digital Services</div>
            </div>
            <div>
              <div class="inv-title">TAX INVOICE</div>
              <div style="font-size: 14px; font-weight: 700; color: #4F46E5;">${receiptData.invoiceNo}</div>
              <div style="font-size: 12px; color: #64748B;">Date: ${new Date(receiptData.date).toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase;">Billed To:</div>
              <div style="font-size: 16px; font-weight: 800; margin-top: 2px;">${receiptData.customerName}</div>
              <div style="font-size: 12px; color: #64748B;">Walk-in Customer</div>
            </div>
            <div class="meta-box">
              <div style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase;">Payment Details:</div>
              <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">Mode: ${(receiptData.payMode || 'cash').toUpperCase()}</div>
              <div style="font-size: 12px; color: ${receiptData.status === 'due' ? '#EF4444' : '#059669'}; font-weight: 700;">
                Status: ${receiptData.status === 'due' ? '⚠️ DUE / UNPAID' : '✅ FULLY PAID'}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Service / Item Description</th>
                <th style="width: 80px; text-align: center;">Pages (Qty)</th>
                <th style="width: 120px; text-align: right;">Rate (₹)</th>
                <th style="width: 120px; text-align: right;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-box">
              <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                <span>Subtotal:</span>
                <strong>₹${(Number(receiptData.subtotal) || 0).toFixed(2)}</strong>
              </div>
              ${gstHtml}
              <div class="grand-row">
                <span>Grand Total:</span>
                <span>₹${(Number(receiptData.amount) || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p style="font-weight: 700; margin: 0 0 4px;">Thank you for your business!</p>
            <p style="margin: 0; font-size: 11px;">Computer Generated Tax Invoice · Powered by WiFiDrop POS</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  async function deleteInvoice(idOrNo) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await axios.delete(`${config.serverUrl}/api/billing/invoices/${idOrNo}`);
      setInvoices((prev) => prev.filter((i) => i._id !== idOrNo && i.no !== idOrNo));
    } catch {
      toast.error('Failed to delete invoice');
    }
  }

  function exportCSV() {
    if (invoices.length === 0) {
      toast.warning('No invoices available to export');
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
                  <BillingCustomerSelect
                    value={customer}
                    onChange={(val) => {
                      setCustomer(val);
                      if (val) loadCustomerPendingItems(val);
                    }}
                    onSelectCustomer={(val) => {
                      setCustomer(val);
                      if (val) loadCustomerPendingItems(val);
                    }}
                    customers={uniqueCustomers}
                    pendingCustomers={pendingCustomers}
                    placeholder="Select or search customer..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <div className="paymode-segmented-group">
                    {[
                      { key: 'cash', label: 'Cash', icon: '💵' },
                      { key: 'upi', label: 'UPI / QR', icon: '📱' },
                      { key: 'card', label: 'Card', icon: '💳' },
                      { key: 'due', label: 'Due / Credit', icon: '⏳' },
                    ].map((pm) => (
                      <button
                        key={pm.key}
                        type="button"
                        className={`paymode-pill-btn ${payMode === pm.key ? 'active' : ''}`}
                        onClick={() => setPayMode(pm.key)}
                      >
                        <span className="paymode-icon">{pm.icon}</span>
                        <span className="paymode-text">{pm.label}</span>
                      </button>
                    ))}
                  </div>
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
                            <th style={{ width: '135px', textAlign: 'center' }}>Pages (Qty)</th>
                            <th style={{ width: '135px', textAlign: 'center' }}>Price / Page (₹)</th>
                            <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                            <th style={{ width: '45px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={item.id || i}>
                              <td>
                                <div className="pos-item-name-wrap flex items-center gap-2">
                                  <span className="pos-item-doc-icon">📄</span>
                                  <input
                                    type="text"
                                    className="input input-sm pos-item-name-input"
                                    placeholder="Service or File name"
                                    value={item.service}
                                    title={item.service}
                                    onChange={(e) => updateItem(i, 'service', e.target.value)}
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="pos-stepper-box">
                                  <button
                                    type="button"
                                    className="pos-stepper-btn"
                                    onClick={() => stepQty(i, -1)}
                                    title="Decrease Qty"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    className="pos-stepper-input"
                                    min={1}
                                    value={item.qty}
                                    onChange={(e) => updateItem(i, 'qty', e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="pos-stepper-btn"
                                    onClick={() => stepQty(i, 1)}
                                    title="Increase Qty"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>
                                <div className="pos-price-field">
                                  <span className="pos-price-symbol">₹</span>
                                  <input
                                    type="number"
                                    className="pos-price-input"
                                    min={0}
                                    step="0.5"
                                    value={item.rate}
                                    onChange={(e) => updateItem(i, 'rate', e.target.value)}
                                  />
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="pos-row-total-badge">
                                  ₹{((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
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
                  💾 Save Bill
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={printCurrentBill}
                  disabled={items.length === 0}
                  style={{ background: '#FFFFFF', fontWeight: 700 }}
                  title="Print compact 80mm POS thermal roll slip"
                >
                  🧾 Print Thermal Slip
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={printCurrentBillA4}
                  disabled={items.length === 0}
                  style={{ background: '#FFFFFF', fontWeight: 700 }}
                  title="Print full A4 Tax Invoice"
                >
                  📄 Print A4 Bill
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => printPastInvoice(inv)}
                                title="Print 80mm Thermal Slip"
                              >
                                🧾 Slip
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => printPastInvoiceA4(inv)}
                                title="Print A4 Tax Invoice"
                              >
                                📄 A4
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: '#EF4444' }}
                                onClick={() => deleteInvoice(inv._id || inv.no)}
                                title="Delete Invoice"
                              >
                                🗑️
                              </button>
                            </div>
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
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => printPastInvoice(inv)}
                          >
                            🧾 Slip
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => printPastInvoiceA4(inv)}
                          >
                            📄 A4
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: '#EF4444' }}
                            onClick={() => deleteInvoice(inv._id || inv.no)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HIDDEN THERMAL RECEIPT SLIP TEMPLATE (Printed on 58mm/80mm POS Printers) ── */}
      {receiptToPrint && (
        <div className="pos-thermal-receipt-printable">
          <div className="pos-slip-header">
            <h2 className="pos-shop-title">{receiptToPrint.shopName}</h2>
            {receiptToPrint.shopPhone && <p className="pos-shop-phone">Phone: {receiptToPrint.shopPhone}</p>}
            <p className="pos-sub-tag">*** CASH MEMO / INVOICE ***</p>
            <div className="pos-line">================================</div>
          </div>

          <div className="pos-slip-meta">
            <div className="pos-meta-row"><span>Bill No:</span> <strong>{receiptToPrint.invoiceNo}</strong></div>
            <div className="pos-meta-row"><span>Date:</span> <span>{new Date(receiptToPrint.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
            <div className="pos-meta-row"><span>Customer:</span> <strong>{receiptToPrint.customerName}</strong></div>
            <div className="pos-meta-row"><span>Payment:</span> <strong>{(receiptToPrint.payMode || 'cash').toUpperCase()}</strong></div>
          </div>

          <div className="pos-line">--------------------------------</div>

          <table className="pos-items-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: '50%' }}>ITEM</th>
                <th style={{ textAlign: 'center', width: '15%' }}>QTY</th>
                <th style={{ textAlign: 'right', width: '15%' }}>RATE</th>
                <th style={{ textAlign: 'right', width: '20%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {receiptToPrint.items.map((it, idx) => (
                <tr key={idx}>
                  <td className="pos-item-col">{it.service || 'Item'}</td>
                  <td style={{ textAlign: 'center' }}>{it.qty || 1}</td>
                  <td style={{ textAlign: 'right' }}>{(Number(it.rate) || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{((Number(it.qty) || 1) * (Number(it.rate) || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pos-line">--------------------------------</div>

          <div className="pos-totals-box">
            <div className="pos-tot-row">
              <span>Subtotal:</span>
              <span>₹{(Number(receiptToPrint.subtotal) || 0).toFixed(2)}</span>
            </div>
            {receiptToPrint.gst > 0 && (
              <div className="pos-tot-row">
                <span>GST (18%):</span>
                <span>₹{(Number(receiptToPrint.gst) || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="pos-line">================================</div>
            <div className="pos-tot-row pos-grand-total">
              <strong>TOTAL AMOUNT:</strong>
              <strong>₹{(Number(receiptToPrint.amount) || 0).toFixed(2)}</strong>
            </div>
            <div className="pos-line">================================</div>
          </div>

          <div className="pos-slip-footer">
            <p className="pos-status-text">
              Status: <strong>{receiptToPrint.status === 'due' ? '⚠️ DUE / UNPAID' : '✅ PAID'}</strong>
            </p>
            <p className="pos-thanks-msg">*** Thank You! Visit Again ***</p>
            <p className="pos-branding">⚡ Powered by WiFiDrop POS</p>
          </div>
        </div>
      )}

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
        .bill-row { display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.25rem; margin-bottom: 1.25rem; align-items: flex-start; }
        .form-group { display: flex; flex-direction: column; gap: 4px; width: 100%; }
        .form-label { font-size: 0.78rem; font-weight: 700; color: #374151; }

        /* ── Modern Segmented Payment Mode ── */
        /* ── Modern Searchable Customer Combobox ── */
        .custom-combobox-wrapper {
          position: relative;
          width: 100%;
        }

        .custom-combobox-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 38px;
          padding: 0 12px;
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
          user-select: none;
        }

        .custom-combobox-trigger:hover {
          border-color: #CBD5E1;
          background: #F8FAFC;
        }

        .combobox-icon {
          font-size: 0.95rem;
          color: #64748B;
        }

        .combobox-val {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .combobox-val.placeholder {
          color: #94A3B8;
          font-weight: 500;
        }

        .combobox-chevron {
          font-size: 0.65rem;
          color: #64748B;
        }

        .combobox-clear-btn {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #E2E8F0;
          color: #475569;
          border: none;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .combobox-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
        }

        .combobox-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #FFFFFF;
          border: 1px solid #CBD5E1;
          border-radius: 14px;
          box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
          z-index: 1000;
          overflow: hidden;
          padding: 6px;
        }

        .combobox-search-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 6px 10px;
          margin-bottom: 6px;
        }

        .combobox-search-icon {
          font-size: 0.82rem;
        }

        .combobox-search-input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.82rem;
          font-weight: 600;
          color: #0F172A;
          outline: none;
        }

        .combobox-search-clear {
          background: none;
          border: none;
          font-size: 10px;
          color: #94A3B8;
          cursor: pointer;
        }

        .combobox-list-container {
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .combobox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 9px;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .combobox-item:hover {
          background: #F1F5F9;
        }

        .combobox-item.selected {
          background: #EEF2FF;
        }

        .combobox-item-avatar {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: #E0E7FF;
          color: #4F46E5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.76rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .combobox-item-avatar.custom {
          background: #FEF3C7;
          color: #D97706;
        }

        .combobox-item-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .combobox-item-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .combobox-item-sub {
          font-size: 0.7rem;
          color: #94A3B8;
        }

        .combobox-item-badge {
          font-size: 0.68rem;
          font-weight: 800;
          color: #4F46E5;
        }

        .combobox-check {
          font-size: 0.85rem;
          font-weight: 900;
          color: #4F46E5;
        }

        .combobox-empty-msg {
          padding: 12px;
          text-align: center;
          font-size: 0.78rem;
          color: #94A3B8;
        }

        .paymode-segmented-group {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          align-items: center;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          padding: 4px;
          border-radius: 12px;
          height: 40px;
          width: 100%;
          box-sizing: border-box;
        }

        .paymode-pill-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 6px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748B;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          height: 100%;
          width: 100%;
          box-sizing: border-box;
          text-align: center;
        }

        .paymode-pill-btn:hover {
          background: #FFFFFF;
          color: #0F172A;
        }

        .paymode-pill-btn.active {
          background: #FFFFFF;
          color: #4F46E5;
          border-color: #CBD5E1;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        .paymode-icon {
          font-size: 0.85rem;
          line-height: 1;
        }

        .paymode-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bill-items-section { margin-bottom: 1.25rem; }
        .bill-items-header { margin-bottom: 0.75rem; }
        .empty-bill-box { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 14px; padding: 1.75rem; text-align: center; }
        
        /* Desktop Bill Table */
        .bill-table-desktop-wrap { width: 100%; }
        .bill-table { width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; table-layout: fixed; }
        .bill-table th { background: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; }
        .bill-table td { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .bill-table tr:last-child td { border-bottom: none; }

        /* ── POS Bill Items Table Elements ── */
        .pos-item-name-wrap { width: 100%; }
        .pos-item-doc-icon { font-size: 1.1rem; flex-shrink: 0; }
        .pos-item-name-input { font-weight: 700; color: #0F172A; border-radius: 10px; border: 1.5px solid #E2E8F0; background: #FFFFFF; }
        .pos-item-name-input:focus { border-color: #4F46E5; }

        .pos-stepper-box {
          display: inline-flex;
          align-items: center;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          overflow: hidden;
          padding: 2px;
          width: 105px;
          margin: 0 auto;
        }

        .pos-stepper-btn {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: none;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .pos-stepper-btn:hover { background: #EEF2FF; color: #4F46E5; }

        .pos-stepper-input {
          width: 42px;
          border: none;
          background: transparent;
          text-align: center;
          font-size: 0.88rem;
          font-weight: 800;
          color: #0F172A;
          outline: none;
          -moz-appearance: textfield;
        }

        .pos-stepper-input::-webkit-outer-spin-button,
        .pos-stepper-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .pos-price-field {
          display: inline-flex;
          align-items: center;
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          overflow: hidden;
          padding: 0 8px;
          width: 110px;
          height: 34px;
          box-sizing: border-box;
          margin: 0 auto;
          transition: all 0.15s ease;
        }

        .pos-price-field:focus-within {
          border-color: #4F46E5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.12);
        }

        .pos-price-symbol {
          font-size: 0.85rem;
          font-weight: 800;
          color: #64748B;
          margin-right: 4px;
        }

        .pos-price-input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.88rem;
          font-weight: 800;
          color: #0F172A;
          outline: none;
        }

        .pos-row-total-badge {
          display: inline-block;
          font-size: 0.92rem;
          font-weight: 900;
          color: #059669;
          background: #ECFDF5;
          border: 1px solid #A7F3D0;
          padding: 4px 10px;
          border-radius: 8px;
          white-space: nowrap;
        }
        
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
        @media (max-width: 860px) {
          .bill-row {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }

        @media (max-width: 768px) {
          .billing-page { gap: 0.875rem; }
          .billing-stats { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
          .billing-stat { padding: 0.75rem 0.875rem; border-radius: 12px; }
          .billing-stat-val { font-size: 1.25rem; }

          .paymode-segmented-group {
            grid-template-columns: repeat(4, 1fr);
            gap: 3px;
            padding: 3px;
          }

          .paymode-pill-btn {
            padding: 5px 2px;
            font-size: 0.68rem;
            gap: 2px;
          }

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

        /* ── Hidden by default on screen ── */
        .pos-thermal-receipt-printable {
          display: none;
        }

        /* ── Dedicated 58mm / 80mm Thermal Receipt POS Printing Rules ── */
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }

          html, body {
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          body * {
            visibility: hidden !important;
          }

          .pos-thermal-receipt-printable,
          .pos-thermal-receipt-printable * {
            visibility: visible !important;
          }

          .pos-thermal-receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 74mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 2mm 3mm !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11.5px !important;
            line-height: 1.35 !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
            z-index: 9999999 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .pos-slip-header {
            text-align: center;
            margin-bottom: 4px;
          }

          .pos-shop-title {
            font-size: 15px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
          }

          .pos-shop-phone {
            font-size: 11px;
            margin: 2px 0 0;
          }

          .pos-sub-tag {
            font-size: 10px;
            margin: 2px 0 0;
            letter-spacing: 0.5px;
          }

          .pos-line {
            font-size: 10px;
            letter-spacing: -1px;
            margin: 3px 0;
            text-align: center;
            overflow: hidden;
            white-space: nowrap;
          }

          .pos-slip-meta {
            margin: 3px 0;
          }

          .pos-meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 2px;
          }

          .pos-items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
            font-size: 11px;
          }

          .pos-items-table th {
            border-bottom: 1px dashed #000;
            padding: 2px 0;
            font-size: 10px;
          }

          .pos-items-table td {
            padding: 2px 0;
            vertical-align: top;
          }

          .pos-item-col {
            word-break: break-word;
            padding-right: 4px;
          }

          .pos-totals-box {
            margin: 4px 0;
          }

          .pos-tot-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 2px;
          }

          .pos-grand-total {
            font-size: 13px;
            font-weight: 900;
          }

          .pos-slip-footer {
            text-align: center;
            margin-top: 6px;
          }

          .pos-status-text {
            font-size: 11px;
            margin: 2px 0;
          }

          .pos-thanks-msg {
            font-size: 11px;
            font-weight: bold;
            margin: 4px 0 2px;
          }

          .pos-branding {
            font-size: 9px;
            margin: 0;
          }

          /* Hide Web UI */
          .main-header,
          .laptop-sidebar,
          .mobile-bottom-nav,
          .toast-container,
          .billing-stats,
          .billing-nav,
          .quick-bill-card,
          .invoice-table-wrapper {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
