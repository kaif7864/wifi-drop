/**
 * processScanPage.js — Warp + filter a captured scan page
 */

import { warpPerspective, limitCanvasSize, clampCorners } from './perspectiveTransform';
import { applyFilter } from './imageFilters';
import { JPEG_QUALITY } from './scanPdfBuilder';

/**
 * @param {HTMLImageElement | HTMLCanvasElement} source
 * @param {import('./perspectiveTransform').Corners} corners
 * @param {'original'|'auto'|'bw'} filter
 * @returns {{ dataUrl: string, thumbnailUrl: string, width: number, height: number }}
 */
export function processScanPage(source, corners, filter) {
  const imgW = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const imgH = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;

  const safeCorners = clampCorners(corners, imgW, imgH);
  let canvas = warpPerspective(source, safeCorners);
  canvas = limitCanvasSize(canvas, 2000);

  const ctx = canvas.getContext('2d');
  applyFilter(ctx, canvas.width, canvas.height, filter);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const thumbnailUrl = createThumbnail(canvas, 120);

  return {
    dataUrl,
    thumbnailUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

function createThumbnail(canvas, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const thumb = document.createElement('canvas');
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h);
  return thumb.toDataURL('image/jpeg', 0.75);
}

/**
 * Load image from data URL or File
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to load image'));

    if (src instanceof File || src instanceof Blob) {
      const url = URL.createObjectURL(src);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
      return;
    }

    img.onload = () => resolve(img);
    img.src = src;
  });
}

/**
 * Capture current video frame to canvas
 * @param {HTMLVideoElement} video
 * @returns {{ canvas: HTMLCanvasElement, dataUrl: string, width: number, height: number }}
 */
export function captureVideoFrame(video) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Camera not ready — wait a moment and try again');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width,
    height,
  };
}
