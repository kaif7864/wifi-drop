/**
 * client/src/utils/billManager.js
 * Manages pending file print billing queue across LaptopView, PrintPage, CustomerFolders, and BillingPage
 */

import { detectPdfPageCount } from './pdfPageCounter';

const STORAGE_KEY = 'wifidrop_pending_bill_items';

export function getPendingBillItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingBillItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('wifidrop_bill_items_updated'));
  } catch {}
}

export function isFileInBill(fileId) {
  if (!fileId) return false;
  const items = getPendingBillItems();
  return items.some((i) => i.fileId === fileId || i.id === fileId);
}

export function toggleFileInBill(file) {
  if (!file) return { added: false };
  const fileId = file.uuid || file.id || file._id;
  if (isFileInBill(fileId)) {
    removePendingBillItem(fileId);
    return { added: false, removed: true };
  } else {
    return addFileToBill(file);
  }
}

export function addFileToBill(file) {
  if (!file) return null;
  const items = getPendingBillItems();
  const fileId = file.uuid || file.id || file._id;

  // Check if file already exists in pending bill
  const existing = items.find((i) => i.fileId === fileId);
  if (existing) {
    return { added: true, item: existing, customerName: existing.customerName };
  }

  const custName = file.customerName || file.deviceName || 'Anonymous Customer';
  const custId = file.customerId || 'cust_anonymous';

  let initialPages = Number(file.pageCount) || 1;
  const isPdf = (file.mimeType && file.mimeType.includes('pdf')) || (file.originalName && file.originalName.toLowerCase().endsWith('.pdf'));

  const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const newItem = {
    id: itemId,
    fileId,
    fileName: file.originalName || 'Document File',
    customerId: custId,
    customerName: custName,
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.size || 0,
    pages: initialPages,
    service: file.mimeType?.startsWith('image/') ? 'Color Print (per page)' : 'B&W Print (per page)',
    rate: file.mimeType?.startsWith('image/') ? 10 : 2,
    addedAt: new Date().toISOString(),
  };

  items.push(newItem);
  savePendingBillItems(items);

  // If pageCount was missing or 1 for a PDF, asynchronously detect exact PDF pages and update item in bill
  if (isPdf && initialPages <= 1) {
    detectPdfPageCount(file).then((exactPages) => {
      if (exactPages > 1) {
        const currentItems = getPendingBillItems();
        const target = currentItems.find((i) => i.id === itemId);
        if (target) {
          target.pages = exactPages;
          savePendingBillItems(currentItems);
        }
      }
    }).catch(() => {});
  }

  return { added: true, item: newItem, customerName: custName };
}

export function removePendingBillItem(itemId) {
  const items = getPendingBillItems().filter((i) => i.id !== itemId && i.fileId !== itemId);
  savePendingBillItems(items);
  return items;
}

export function clearPendingBillForCustomer(customerNameOrId) {
  if (!customerNameOrId) return [];
  const cleanTarget = customerNameOrId.toLowerCase().trim();
  const items = getPendingBillItems().filter((i) => {
    const nameMatch = (i.customerName || '').toLowerCase().trim() === cleanTarget;
    const idMatch = (i.customerId || '').toLowerCase().trim() === cleanTarget;
    return !nameMatch && !idMatch;
  });
  savePendingBillItems(items);
  return items;
}
