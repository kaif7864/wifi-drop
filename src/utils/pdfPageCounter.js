import { config } from '../config';

export async function detectPdfPageCount(fileObj) {
  if (!fileObj) return 1;
  if (typeof fileObj.pageCount === 'number' && fileObj.pageCount > 0) {
    return fileObj.pageCount;
  }

  const mime = fileObj.mimeType || fileObj.type || '';
  const name = fileObj.originalName || fileObj.name || '';
  const isPdf = mime.includes('pdf') || name.toLowerCase().endsWith('.pdf');

  if (!isPdf) return 1;

  try {
    let arrayBuffer = null;

    if (fileObj instanceof Blob || fileObj instanceof File) {
      arrayBuffer = await fileObj.arrayBuffer();
    } else if (fileObj.blob instanceof Blob) {
      arrayBuffer = await fileObj.blob.arrayBuffer();
    } else if (fileObj.previewUrl || fileObj.downloadUrl || fileObj.cloudinarySecureUrl || fileObj.uuid || fileObj.id) {
      const rawUrl = fileObj.previewUrl || fileObj.downloadUrl || (fileObj.uuid || fileObj.id ? `/api/files/${fileObj.uuid || fileObj.id}/preview` : '');
      const targetUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:'))
        ? rawUrl
        : `${config.serverUrl}${rawUrl}`;
      if (targetUrl) {
        const res = await fetch(targetUrl);
        arrayBuffer = await res.arrayBuffer();
      }
    }

    if (arrayBuffer) {
      return parsePdfPageCountFromArrayBuffer(arrayBuffer);
    }
  } catch (err) {
    console.warn('[PDF Page Counter Client Warning]:', err.message);
  }

  return 1;
}

export function parsePdfPageCountFromArrayBuffer(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const str = new TextDecoder('latin1').decode(bytes);

    // Strategy 1: Match /Count N in catalog /Pages object
    const countMatches = [...str.matchAll(/\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const maxCount = Math.max(...countMatches.map((m) => parseInt(m[1], 10)));
      if (maxCount > 0 && maxCount < 10000) return maxCount;
    }

    // Strategy 2: Count /Type /Page occurrences
    const pageMatches = str.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
  } catch {}

  return 1;
}
