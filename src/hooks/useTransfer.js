/**
 * client/src/hooks/useTransfer.js
 * Manages file/text transfer state and API calls
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config';

const BASE_URL = config.serverUrl;

export function useTransfer() {
  const [files, setFiles] = useState([]);
  const [texts, setTexts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  // ── Push a file received via socket ──────────────────────────────────────
  const addReceivedFile = useCallback((fileRecord) => {
    if (!fileRecord) return;
    setFiles((prev) => {
      const targetId = fileRecord.uuid || fileRecord.id || fileRecord._id;
      if (targetId && prev.some((f) => (f.uuid || f.id || f._id) === targetId)) {
        return prev;
      }
      return [fileRecord, ...prev];
    });
  }, []);

  // ── Push a text received via socket ───────────────────────────────────────
  const addReceivedText = useCallback((textRecord) => {
    if (!textRecord) return;
    setTexts((prev) => {
      const targetId = textRecord.uuid || textRecord.id || textRecord._id;
      if (targetId && prev.some((t) => (t.uuid || t.id || t._id) === targetId)) {
        return prev;
      }
      return [textRecord, ...prev];
    });
  }, []);

  // ── Upload files from mobile ──────────────────────────────────────────────
  const uploadFiles = useCallback(async (fileList, deviceName, sessionId = null, shopId = 'default', customerId = null, customerName = null) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append('files', file));
    formData.append('deviceName', deviceName);
    if (sessionId) formData.append('sessionId', sessionId);
    formData.append('shopId', shopId);
    if (customerId) formData.append('customerId', customerId);
    if (customerName) formData.append('customerName', customerName);

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
  const sendText = useCallback(async (text, deviceName, sessionId = null, shopId = 'default', customerId = null, customerName = null) => {
    setError(null);
    try {
      const response = await axios.post(`${BASE_URL}/api/text`, {
        text,
        deviceName,
        sessionId,
        shopId,
        customerId,
        customerName,
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
  const fetchHistory = useCallback(async (shopId = null) => {
    try {
      const configObj = shopId ? { params: { shopId } } : {};
      const [fileRes, textRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/files`, configObj),
        axios.get(`${BASE_URL}/api/text`, configObj),
      ]);
      setFiles(fileRes.data.files || []);
      setTexts(textRes.data.texts || []);
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
