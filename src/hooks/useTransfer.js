/**
 * client/src/hooks/useTransfer.js
 * Manages file/text transfer state and API calls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { config } from '../config';

const BASE_URL = config.serverUrl;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export function useTransfer(shopId = null) {
  const isShopOwner = !!(shopId && shopId !== 'guest' && shopId !== 'default' && !shopId.startsWith('wd_'));
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
        const validFiles = files.filter((f) => f && (f.shopId === shopId || f.sessionId === shopId));
        const validTexts = texts.filter((t) => t && (t.shopId === shopId || t.sessionId === shopId));
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), files: validFiles, texts: validTexts }));
      } catch {}
    }
  }, [files, texts, isShopOwner, cacheKey, shopId]);

  // ── Push a file received via socket ──────────────────────────────────────
  const addReceivedFile = useCallback((fileRecord) => {
    if (!fileRecord) return;
    // Security check: only accept files matching current shop or guest session
    if (shopId && shopId !== 'guest') {
      if (fileRecord.shopId && fileRecord.shopId !== 'default' && fileRecord.shopId !== shopId) {
        return; // Ignore files from another shop
      }
    } else {
      // Guest mode: ignore any file belonging to a registered shop
      if (fileRecord.shopId && fileRecord.shopId !== 'default') {
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
    if (shopId && shopId !== 'guest') {
      if (textRecord.shopId && textRecord.shopId !== 'default' && textRecord.shopId !== shopId) {
        return;
      }
    } else {
      if (textRecord.shopId && textRecord.shopId !== 'default') {
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
  const uploadFiles = useCallback(async (fileList, deviceName, sessionId = null, shopId = 'default', customerId = null, customerName = null, deviceId = null, fileNotes = {}) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('shopId', shopId || 'default');
    if (sessionId) formData.append('sessionId', sessionId);
    formData.append('deviceName', deviceName);
    if (customerId) formData.append('customerId', customerId);
    if (customerName) formData.append('customerName', customerName);
    if (deviceId) formData.append('deviceId', deviceId);
    if (fileNotes && Object.keys(fileNotes).length > 0) {
      formData.append('fileNotes', JSON.stringify(fileNotes));
    }
    Array.from(fileList).forEach((file) => formData.append('files', file));

    try {
      const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percent);
        },
      });
      return response.data;
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
      const response = await axios.post(`${BASE_URL}/api/text`, {
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
      await axios.delete(`${BASE_URL}/api/files/${targetId}`);
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
      await axios.delete(`${BASE_URL}/api/text/${targetId}`);
      setTexts((prev) => prev.filter((t) => t.id !== targetId && t.uuid !== targetId && t._id !== targetId));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // ── Fetch existing history on mount ──────────────────────────────────────
  const fetchHistory = useCallback(async (fetchShopId = null, fetchSessionId = null, fetchToken = null) => {
    try {
      const params = {};
      if (fetchShopId) params.shopId = fetchShopId;
      if (fetchSessionId) params.session = fetchSessionId;

      const headers = {};
      const resolvedToken = fetchToken || (fetchShopId ? localStorage.getItem('wifidrop_token') : null);
      if (resolvedToken) headers['Authorization'] = `Bearer ${resolvedToken}`;

      const [fileRes, textRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/files`, { params, headers }),
        axios.get(`${BASE_URL}/api/text`, { params, headers }),
      ]);

      const fetchedFiles = Array.isArray(fileRes.data.files) ? fileRes.data.files : [];
      const fetchedTexts = Array.isArray(textRes.data.texts) ? textRes.data.texts : [];

      setFiles(fetchedFiles);
      setTexts(fetchedTexts);
    } catch {
      // silently fail on history fetch
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
      await axios.patch(`${BASE_URL}/api/files/${targetId}/print`);
    } catch (err) {
      console.warn('[Print Status Toggle Error]:', err.message);
    }
  }, []);

  // ── Delete an entire customer folder ──────────────────────────────────────
  const deleteCustomerFolder = useCallback(async (customerId) => {
    if (!customerId) return;
    try {
      await axios.delete(`${BASE_URL}/api/files/customer/${encodeURIComponent(customerId)}`);
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

  return {
    files,
    texts,
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
  };
}
