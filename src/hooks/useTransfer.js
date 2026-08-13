/**
 * client/src/hooks/useTransfer.js
 * Manages file/text transfer state and API calls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { config } from '../config';
import { shouldUseChunkedUpload, uploadSingleFileChunked } from '../utils/chunkedUpload';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const getBaseUrl = () => config.serverUrl;
const BASE_URL = config.serverUrl;


function isRetryableUploadError(err) {
  if (!err) return false;
  if (err.response?.status === 413) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return !err.response || code === 'ERR_NETWORK' || code === 'ECONNABORTED' || msg.includes('network error');
}

async function postUploadWithRetry(url, formData, options, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post(url, formData, options);
    } catch (err) {
      lastErr = err;
      if (!isRetryableUploadError(err) || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

export function useTransfer(shopId = null) {
  const isShopOwner = !!(
    shopId &&
    shopId !== 'guest' &&
    shopId !== 'default' &&
    !shopId.startsWith('wd_') &&
    !shopId.startsWith('temp_') &&
    localStorage.getItem('wifidrop_token')
  );
  const cacheKey = isShopOwner ? `wifidrop_files_cache_${shopId}` : null;

  const [files, setFiles] = useState(() => {
    if (!isShopOwner || !cacheKey) return [];
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const loaded = Array.isArray(parsed.files) ? parsed.files : [];
      return loaded.filter((f) => f && (f.shopId === shopId || f.sessionId === shopId));
    } catch {
      return [];
    }
  });

  const [texts, setTexts] = useState(() => {
    if (!isShopOwner || !cacheKey) return [];
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const loaded = Array.isArray(parsed.texts) ? parsed.texts : [];
      return loaded.filter((t) => t && (t.shopId === shopId || t.sessionId === shopId));
    } catch {
      return [];
    }
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  // ── Shop Owner Custom Folders ─────────────────────────────────────────────
  const [shopFolders, setShopFolders] = useState([]);

  const prevShopIdRef = useRef(shopId);

  // Sync state whenever shopId transitions (login / logout)
  useEffect(() => {
    if (prevShopIdRef.current !== shopId) {
      prevShopIdRef.current = shopId;
      if (isShopOwner && cacheKey) {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const validFiles = (Array.isArray(parsed.files) ? parsed.files : []).filter((f) => f && (f.shopId === shopId || f.sessionId === shopId));
            const validTexts = (Array.isArray(parsed.texts) ? parsed.texts : []).filter((t) => t && (t.shopId === shopId || t.sessionId === shopId));
            setFiles(validFiles);
            setTexts(validTexts);
            return;
          }
        } catch {}
      }
      // If guest or no cache, always start completely empty
      setFiles([]);
      setTexts([]);
    }
  }, [shopId, isShopOwner, cacheKey]);

  // Persist shop files to cache only for logged-in shop owners
  useEffect(() => {
    if (isShopOwner && cacheKey) {
      try {
        const sId = (shopId || '').toLowerCase().trim();
        const matchesShop = (item) => {
          if (!item) return false;
          const iShop = (item.shopId || '').toLowerCase().trim();
          const iSess = (item.sessionId || '').toLowerCase().trim();
          return !sId || iShop === sId || iSess === sId || iShop === 'default';
        };
        const validFiles = files.filter(matchesShop);
        const validTexts = texts.filter(matchesShop);
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), files: validFiles, texts: validTexts }));
      } catch {}
    }
  }, [files, texts, isShopOwner, cacheKey, shopId]);


  // ── Push a file received via socket ──────────────────────────────────────
  const addReceivedFile = useCallback((fileRecord) => {
    if (!fileRecord) return;
    const currentShop = (shopId || '').toLowerCase().trim();
    const recShop = (fileRecord.shopId || 'default').toLowerCase().trim();

    if (currentShop && currentShop !== 'guest' && currentShop !== 'default') {
      if (recShop && recShop !== 'default' && recShop !== currentShop) {
        return; // Ignore files from another shop
      }
    } else if (currentShop === 'guest' || !currentShop || currentShop === 'default') {
      if (recShop && recShop !== 'default') {
        return;
      }
    }

    setFiles((prev) => {
      const targetId = fileRecord.uuid || fileRecord.id || fileRecord._id;
      if (targetId && prev.some((f) => (f.uuid || f.id || f._id) === targetId)) {
        return prev;
      }
      return [fileRecord, ...prev];
    });
  }, [shopId]);

  // ── Push a text received via socket ───────────────────────────────────────
  const addReceivedText = useCallback((textRecord) => {
    if (!textRecord) return;
    const currentShop = (shopId || '').toLowerCase().trim();
    const recShop = (textRecord.shopId || 'default').toLowerCase().trim();

    if (currentShop && currentShop !== 'guest' && currentShop !== 'default') {
      if (recShop && recShop !== 'default' && recShop !== currentShop) {
        return;
      }
    } else if (currentShop === 'guest' || !currentShop || currentShop === 'default') {
      if (recShop && recShop !== 'default') {
        return;
      }
    }

    setTexts((prev) => {
      const targetId = textRecord.uuid || textRecord.id || textRecord._id;
      if (targetId && prev.some((t) => (t.uuid || t.id || t._id) === targetId)) {
        return prev;
      }
      return [textRecord, ...prev];
    });
  }, [shopId]);

  // ── Upload files from mobile ──────────────────────────────────────────────
  const uploadFiles = useCallback(async (fileList, deviceName, sessionId = null, shopId = 'default', customerId = null, customerName = null, deviceId = null, fileNotes = {}, folderId = null) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const files = Array.from(fileList);
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const hasPdf = files.some(
      (f) => f.type?.includes('pdf') || f.name?.toLowerCase().endsWith('.pdf')
    );
    const uploadTimeout = hasPdf
      ? 600000
      : totalSize > 1024 * 1024
        ? Math.min(600000, Math.max(120000, 120000 + Math.round(totalSize / 1024)))
        : 120000;

    const meta = {
      shopId: shopId || 'default',
      sessionId,
      deviceName,
      customerId,
      customerName,
      deviceId,
      folderId,
    };

    try {
      const allResults = [];
      let customer = null;

      // Large files (>10MB): chunked upload with per-chunk retry
      for (let i = 0; i < files.length; i++) {
        if (!shouldUseChunkedUpload(files[i])) continue;
        const note = fileNotes[i] || fileNotes[files[i].name] || '';
        const data = await uploadSingleFileChunked(
          files[i],
          { ...meta, note },
          (pct) => setUploadProgress(pct)
        );
        if (data?.files) allResults.push(...data.files);
        if (data?.customer) customer = data.customer;
      }

      // Small/medium files: single multipart request (batched)
      const batch = files.filter((f) => !shouldUseChunkedUpload(f));
      if (batch.length > 0) {
        const formData = new FormData();
        formData.append('shopId', meta.shopId);
        if (sessionId) formData.append('sessionId', sessionId);
        formData.append('deviceName', deviceName);
        if (customerId) formData.append('customerId', customerId);
        if (customerName) formData.append('customerName', customerName);
        if (deviceId) formData.append('deviceId', deviceId);
        if (folderId) formData.append('folderId', folderId);


        const notesPayload = {};
        batch.forEach((file) => {
          const origIdx = files.indexOf(file);
          const note = fileNotes[origIdx] || fileNotes[file.name] || '';
          if (note) notesPayload[file.name] = note;
        });
        if (Object.keys(notesPayload).length > 0) {
          formData.append('fileNotes', JSON.stringify(notesPayload));
        }
        batch.forEach((file) => formData.append('files', file));

        const response = await postUploadWithRetry(
          `${getBaseUrl()}/api/upload`,
          formData,
          {
            timeout: uploadTimeout,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            onUploadProgress: (progressEvent) => {
              const percent = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 1)
              );
              setUploadProgress(percent);
            },
          },
          3
        );

        if (response.data?.files) allResults.push(...response.data.files);
        if (response.data?.customer) customer = response.data.customer;
      }

      setUploadProgress(100);
      return { success: true, files: allResults, customer };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Send text from mobile ─────────────────────────────────────────────────
  const sendText = useCallback(async (text, deviceName, sessionId = null, shopId = 'default', customerId = null, customerName = null, deviceId = null) => {
    setError(null);
    try {
      const response = await axios.post(`${getBaseUrl()}/api/text`, {
        text,
        deviceName,
        sessionId,
        shopId,
        customerId,
        customerName,
        deviceId,
      });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  // ── Delete a file (laptop dashboard) ─────────────────────────────────────
  const deleteFile = useCallback(async (fileOrId) => {
    const targetId = typeof fileOrId === 'object' ? (fileOrId.uuid || fileOrId.id || fileOrId._id) : fileOrId;
    if (!targetId) return;

    try {
      await axios.delete(`${getBaseUrl()}/api/files/${targetId}`);
      setFiles((prev) => prev.filter((f) => f.id !== targetId && f.uuid !== targetId && f._id !== targetId));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // ── Delete a text record ──────────────────────────────────────────────────
  const deleteText = useCallback(async (textOrId) => {
    const targetId = typeof textOrId === 'object' ? (textOrId.uuid || textOrId.id || textOrId._id) : textOrId;
    if (!targetId) return;

    try {
      await axios.delete(`${getBaseUrl()}/api/text/${targetId}`);
      setTexts((prev) => prev.filter((t) => t.id !== targetId && t.uuid !== targetId && t._id !== targetId));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // ── Fetch existing history on mount ──────────────────────────────────────
  const fetchHistory = useCallback(async (fetchShopId = null, fetchSessionId = null, fetchToken = null, fetchCustomerId = null) => {
    try {
      const params = {};
      if (fetchShopId) params.shopId = fetchShopId;
      if (fetchSessionId) params.session = fetchSessionId;
      if (fetchCustomerId) params.customerId = fetchCustomerId;

      const headers = {};
      const resolvedToken = fetchToken || (fetchShopId ? localStorage.getItem('wifidrop_token') : null);
      if (resolvedToken) headers['Authorization'] = `Bearer ${resolvedToken}`;

      const [fileRes, textRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/files`, { params, headers }),
        axios.get(`${getBaseUrl()}/api/text`, { params, headers }),
      ]);

      const fetchedFiles = Array.isArray(fileRes.data.files) ? fileRes.data.files : [];
      const fetchedTexts = Array.isArray(textRes.data.texts) ? textRes.data.texts : [];

      setFiles(fetchedFiles);
      setTexts(fetchedTexts);
      return { files: fetchedFiles, texts: fetchedTexts };
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404 || err.response?.data?.expired) {
        setFiles([]);
        setTexts([]);
      }
      throw err;
    }
  }, []);

  // ── Toggle file print status ─────────────────────────────────────────────
  const togglePrintStatus = useCallback(async (fileOrId) => {
    const targetId = typeof fileOrId === 'object' ? (fileOrId.uuid || fileOrId.id || fileOrId._id) : fileOrId;
    if (!targetId) return;

    setFiles((prev) =>
      prev.map((f) => {
        const id = f.uuid || f.id || f._id;
        if (id === targetId || f.uuid === targetId || f.id === targetId || (f._id && String(f._id) === String(targetId))) {
          return { ...f, printedStatus: !f.printedStatus };
        }
        return f;
      })
    );

    try {
      await axios.patch(`${getBaseUrl()}/api/files/${targetId}/print`);
    } catch (err) {
      console.warn('[Print Status Toggle Error]:', err.message);
    }
  }, []);

  // ── Delete an entire customer folder ──────────────────────────────────────
  const deleteCustomerFolder = useCallback(async (customerId) => {
    if (!customerId) return;
    try {
      await axios.delete(`${getBaseUrl()}/api/files/customer/${encodeURIComponent(customerId)}`);
      const isName = customerId.startsWith('name_');
      const rawName = isName ? customerId.replace('name_', '').toLowerCase() : null;
      const matchHash = customerId.match(/(?:cust_|#)?([A-Z0-9]{6})/i);
      const hash = matchHash ? matchHash[1].toLowerCase() : null;

      const matchesItem = (item) => {
        if (isName && item.customerName && item.customerName.toLowerCase().trim() === rawName) return true;
        if (item.customerId === customerId) return true;
        if (hash) {
          if (item.customerId && item.customerId.toLowerCase().includes(hash)) return true;
          if (item.deviceName && item.deviceName.toLowerCase().includes(`#${hash}`)) return true;
        }
        return false;
      };

      setFiles((prev) => prev.filter((f) => !matchesItem(f)));
      setTexts((prev) => prev.filter((t) => !matchesItem(t)));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // ── Create a new shop folder ───────────────────────────────────────────────
  const createShopFolder = useCallback(async ({ folderName, description = '', category, type, customerId }) => {
    const token = localStorage.getItem('wifidrop_token');
    if (!token) throw new Error('Not authenticated');
    try {
      const response = await axios.post(
        `${BASE_URL}/api/folders`,
        { folderName, description, category, type, customerId, shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success && response.data.folder) {
        setShopFolders((prev) => [response.data.folder, ...prev]);
        return response.data.folder;
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, [shopId]);


  // ── Fetch shop owner's custom folders ─────────────────────────────────────
  const fetchShopFolders = useCallback(async () => {
    if (!isShopOwner) return;
    const token = localStorage.getItem('wifidrop_token');
    if (!token) return;
    try {
      const response = await axios.get(`${BASE_URL}/api/folders`, {
        params: { shopId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setShopFolders(response.data.folders || []);
      }
    } catch (err) {
      console.warn('[fetchShopFolders]:', err.message);
    }
  }, [shopId, isShopOwner]);

  // ── Upload files into a specific shop folder ───────────────────────────────
  const uploadFilesToFolder = useCallback(async (fileList, folderId, customerName = '') => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    const token = localStorage.getItem('wifidrop_token');

    const formData = new FormData();
    formData.append('shopId', shopId || 'default');
    formData.append('folderId', folderId);
    formData.append('deviceName', 'Shop Owner');
    formData.append('uploadMethod', 'web');
    if (customerName) formData.append('customerName', customerName);
    Array.from(fileList).forEach((file) => formData.append('files', file));

    try {
      const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
        timeout: 90000,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percent);
        },
      });
      // Refresh folder stats after upload
      await fetchShopFolders();
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [shopId, fetchShopFolders]);

  // ── Delete a shop folder ──────────────────────────────────────────────────
  const deleteShopFolder = useCallback(async (folderId) => {
    const token = localStorage.getItem('wifidrop_token');
    if (!token) throw new Error('Not authenticated');
    try {
      await axios.delete(`${BASE_URL}/api/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShopFolders((prev) => prev.filter((f) => f.folderId !== folderId));
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);
  // ── Rename/Update a shop folder ───────────────────────────────────────────
  const renameShopFolder = useCallback(async (folderId, { folderName, description }) => {
    const token = localStorage.getItem('wifidrop_token');
    if (!token) throw new Error('Not authenticated');
    try {
      const response = await axios.patch(
        `${BASE_URL}/api/folders/${folderId}`,
        { folderName, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setShopFolders((prev) =>
          prev.map((f) => (f.folderId === folderId ? { ...f, folderName, description } : f))
        );
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  // ── Move a file to a folder ────────────────────────────────────────────────
  const moveFile = useCallback(async (fileId, targetFolderId) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/files/${fileId}/move`, { targetFolderId });
      if (response.data.success) {
        const updates = response.data.updates || (
          targetFolderId && targetFolderId.startsWith('cust_')
            ? { customerId: targetFolderId, folderId: null }
            : { folderId: targetFolderId || null, customerId: null }
        );
        setFiles((prev) =>
          prev.map((f) => {
            const fId = f.uuid || f.id || f._id;
            if (fId === fileId) {
              return { ...f, ...updates };
            }
            return f;
          })
        );
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  // ── Copy a file to a folder ────────────────────────────────────────────────
  const copyFile = useCallback(async (fileId, targetFolderId) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/files/${fileId}/copy`, { targetFolderId });
      if (response.data.success && response.data.file) {
        setFiles((prev) => [response.data.file, ...prev]);
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  // ── Bulk Move Files ─────────────────────────────────────────────────────────
  const bulkMoveFiles = useCallback(async (fileIds, targetFolderId) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/files/bulk-move`, { fileIds, targetFolderId });
      if (response.data.success) {
        const idSet = new Set(fileIds);
        const updates = response.data.updates || (
          targetFolderId && targetFolderId.startsWith('cust_')
            ? { customerId: targetFolderId, folderId: null }
            : { folderId: targetFolderId || null, customerId: null }
        );
        setFiles((prev) =>
          prev.map((f) => {
            const fId = f.uuid || f.id || f._id;
            if (idSet.has(fId)) {
              return { ...f, ...updates };
            }
            return f;
          })
        );
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);


  // ── Bulk Copy Files ─────────────────────────────────────────────────────────
  const bulkCopyFiles = useCallback(async (fileIds, targetFolderId) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/files/bulk-copy`, { fileIds, targetFolderId });
      if (response.data.success && Array.isArray(response.data.files)) {
        setFiles((prev) => [...response.data.files, ...prev]);
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  // ── Bulk Delete Files ───────────────────────────────────────────────────────
  const bulkDeleteFiles = useCallback(async (fileIds) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/files/bulk-delete`, { fileIds });
      if (response.data.success) {
        const idSet = new Set(fileIds);
        setFiles((prev) => prev.filter((f) => !idSet.has(f.uuid || f.id || f._id)));
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      throw err;
    }
  }, []);

  return {
    files,
    texts,
    shopFolders,
    uploading,
    uploadProgress,
    error,
    addReceivedFile,
    addReceivedText,
    uploadFiles,
    sendText,
    deleteFile,
    deleteText,
    deleteCustomerFolder,
    togglePrintStatus,
    fetchHistory,
    createShopFolder,
    fetchShopFolders,
    uploadFilesToFolder,
    deleteShopFolder,
    renameShopFolder,
    moveFile,
    copyFile,
    bulkMoveFiles,
    bulkCopyFiles,
    bulkDeleteFiles,
  };
}



