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
    setFiles((prev) => [fileRecord, ...prev]);
  }, []);

  // ── Push a text received via socket ───────────────────────────────────────
  const addReceivedText = useCallback((textRecord) => {
    setTexts((prev) => [textRecord, ...prev]);
  }, []);

  // ── Upload files from mobile ──────────────────────────────────────────────
  const uploadFiles = useCallback(async (fileList, deviceName, sessionId = null) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append('files', file));
    formData.append('deviceName', deviceName);
    if (sessionId) formData.append('sessionId', sessionId);

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
  const sendText = useCallback(async (text, deviceName, sessionId = null) => {
    setError(null);
    try {
      const response = await axios.post(`${BASE_URL}/api/text`, {
        text,
        deviceName,
        sessionId,
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
  const fetchHistory = useCallback(async () => {
    try {
      const [fileRes, textRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/files`),
        axios.get(`${BASE_URL}/api/text`),
      ]);
      setFiles(fileRes.data.files || []);
      setTexts(textRes.data.texts || []);
    } catch {
      // silently fail on history fetch
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
    fetchHistory,
  };
}
