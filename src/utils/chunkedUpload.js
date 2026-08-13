/**
 * Chunked upload for large files (>10MB) on Live Relay / slow networks
 */

import axios from 'axios';
import { config } from '../config';

const CHUNK_SIZE = 5 * 1024 * 1024;
export const CHUNKED_THRESHOLD = 10 * 1024 * 1024;

const getBaseUrl = () => config.serverUrl;

function isRetryable(err) {
  if (!err) return false;
  if (err.response?.status === 413) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return !err.response || code === 'ERR_NETWORK' || code === 'ECONNABORTED' || msg.includes('network error');
}

async function postWithRetry(url, data, options, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post(url, data, options);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/**
 * @param {File} file
 * @param {object} meta - shopId, sessionId, deviceName, customerId, customerName, deviceId, note
 * @param {(pct: number) => void} onProgress
 */
export async function uploadSingleFileChunked(file, meta, onProgress) {
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const base = getBaseUrl();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk, `${file.name}.part`);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));

    await postWithRetry(
      `${base}/api/upload/chunk`,
      formData,
      {
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (e) => {
          const loaded = chunkIndex * CHUNK_SIZE + (e.loaded || 0);
          const pct = Math.round((loaded * 100) / file.size);
          onProgress?.(Math.min(99, pct));
        },
      },
      3
    );
  }

  const combineRes = await postWithRetry(
    `${base}/api/upload/combine`,
    {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      mimeType: file.type || 'application/octet-stream',
      shopId: meta.shopId || 'default',
      sessionId: meta.sessionId || null,
      deviceName: meta.deviceName,
      customerId: meta.customerId || null,
      customerName: meta.customerName || null,
      deviceId: meta.deviceId || null,
      note: meta.note || '',
    },
    { timeout: 180000 },
    2
  );

  onProgress?.(100);
  return combineRes.data;
}

export function shouldUseChunkedUpload(file) {
  return file && file.size > CHUNKED_THRESHOLD;
}
