/**
 * edgeDetectionLite.js — Fast document edge detect (no OpenCV, no CDN)
 */

import { orderCorners } from './edgeDetection';

const DETECT_MAX_WIDTH = 480;

function downscaleCanvas(source, maxWidth) {
  const w = source.width;
  const h = source.height;
  const scale = w > maxWidth ? maxWidth / w : 1;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas;
}

function sampleRegion(gray, width, height, sx, sy, size) {
  let sum = 0;
  let n = 0;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = Math.min(width - 1, Math.max(0, sx + dx));
      const y = Math.min(height - 1, Math.max(0, sy + dy));
      sum += gray[y * width + x];
      n++;
    }
  }
  return sum / n;
}

/**
 * Detect document quad from canvas — runs in ~50–200ms on mobile
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {number} fullWidth
 * @param {number} fullHeight
 * @returns {import('./perspectiveTransform').Corners | null}
 */
export function detectDocumentCornersLite(sourceCanvas, fullWidth, fullHeight) {
  const canvas = downscaleCanvas(sourceCanvas, DETECT_MAX_WIDTH);
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height);

  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  const patch = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const bg =
    (sampleRegion(gray, width, height, 0, 0, patch) +
      sampleRegion(gray, width, height, width - patch, 0, patch) +
      sampleRegion(gray, width, height, 0, height - patch, patch) +
      sampleRegion(gray, width, height, width - patch, height - patch, patch)) /
    4;

  const diffThreshold = 18;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(gray[y * width + x] - bg) > diffThreshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hits++;
      }
    }
  }

  const minHits = width * height * 0.04;
  if (hits < minHits || maxX <= minX + 4 || maxY <= minY + 4) {
    return null;
  }

  let maxMag = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] -
        2 * gray[idx - 1] +
        2 * gray[idx + 1] -
        gray[idx + width - 1] +
        gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] -
        2 * gray[idx - width] -
        gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1];
      const mag = Math.hypot(gx, gy);
      if (mag > maxMag) maxMag = mag;
    }
  }

  const thresh = Math.max(20, maxMag * 0.22);

  const scanToEdge = (startX, startY, stepX, stepY) => {
    let x = startX;
    let y = startY;
    const limit = Math.max(width, height) * 1.5;

    for (let i = 0; i < limit; i++) {
      x += stepX;
      y += stepY;
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 1 || ix >= width - 1 || iy < 1 || iy >= height - 1) break;

      const idx = iy * width + ix;
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] -
        2 * gray[idx - 1] +
        2 * gray[idx + 1] -
        gray[idx + width - 1] +
        gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] -
        2 * gray[idx - width] -
        gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1];
      if (Math.hypot(gx, gy) >= thresh) {
        return { x: ix, y: iy };
      }
    }

    return {
      x: Math.min(width - 1, Math.max(0, Math.round(x))),
      y: Math.min(height - 1, Math.max(0, Math.round(y))),
    };
  };

  const inset = 2;
  const tl = scanToEdge(minX + inset, minY + inset, 1, 1);
  const tr = scanToEdge(maxX - inset, minY + inset, -1, 1);
  const br = scanToEdge(maxX - inset, maxY - inset, -1, -1);
  const bl = scanToEdge(minX + inset, maxY - inset, 1, -1);

  const scaleX = fullWidth / width;
  const scaleY = fullHeight / height;

  const points = [
    { x: tl.x * scaleX, y: tl.y * scaleY },
    { x: tr.x * scaleX, y: tr.y * scaleY },
    { x: br.x * scaleX, y: br.y * scaleY },
    { x: bl.x * scaleX, y: bl.y * scaleY },
  ];

  return orderCorners(points);
}
