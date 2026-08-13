/**
 * client/src/utils/offlineQueue.js
 * Mode 4: Mobile Browser IndexedDB Staging & Disconnection Auto-Resume Queue
 */

const DB_NAME = 'WiFiDropOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function stageUploadInQueue(item) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add({
        ...item,
        stagedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[Offline Queue Staging Error]:', err);
    return false;
  }
}

export async function getStagedQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    return [];
  }
}

export async function clearStagedItem(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    return false;
  }
}

export async function stageFilesInQueue(files, meta, fileNotes = {}) {
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    await stageUploadInQueue({
      type: 'file',
      file: f,
      fileName: f.name,
      fileSize: f.size,
      fileType: f.type,
      note: fileNotes[i] || '',
      ...meta,
    });
  }
}
