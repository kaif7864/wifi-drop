/**
 * edgeDetection.js — OpenCV document edge / corner auto-detection
 */

import { loadOpenCV } from './opencvLoader';
import { defaultCorners } from './perspectiveTransform';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ tl: Point, tr: Point, br: Point, bl: Point }} Corners */

const DETECT_MAX_WIDTH = 420;

/**
 * Detect document quadrilateral from image canvas.
 * @param {HTMLCanvasElement} canvas — downscaled frame
 * @param {number} fullWidth — original source width for coordinate mapping
 * @param {number} fullHeight — original source height
 * @returns {Promise<Corners|null>}
 */
export async function detectDocumentCorners(canvas, fullWidth, fullHeight) {
  try {
    const cv = await loadOpenCV();
    const scaleX = fullWidth / canvas.width;
    const scaleY = fullHeight / canvas.height;

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 55, 150);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = canvas.width * canvas.height * 0.06;
    let bestApprox = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        const area = cv.contourArea(approx);
        if (area > minArea && area > bestArea) {
          if (bestApprox) bestApprox.delete();
          bestArea = area;
          bestApprox = approx;
        } else {
          approx.delete();
        }
      } else {
        approx.delete();
      }
      cnt.delete();
    }

    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    if (!bestApprox) return null;

    const points = [];
    for (let i = 0; i < 4; i++) {
      const pt = bestApprox.intPtr(i, 0);
      points.push({
        x: pt[0] * scaleX,
        y: pt[1] * scaleY,
      });
    }
    bestApprox.delete();

    return orderCorners(points);
  } catch (err) {
    console.warn('[EdgeDetection]', err.message);
    return null;
  }
}

/**
 * Capture video frame to downscaled canvas for detection
 * @param {HTMLVideoElement} video
 * @returns {HTMLCanvasElement|null}
 */
export function frameToDetectCanvas(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = vw > DETECT_MAX_WIDTH ? DETECT_MAX_WIDTH / vw : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Run detection on video; returns corners in video pixel space or null
 * @param {HTMLVideoElement} video
 * @returns {Promise<Corners|null>}
 */
export async function detectFromVideo(video) {
  const canvas = frameToDetectCanvas(video);
  if (!canvas) return null;
  return detectDocumentCorners(canvas, video.videoWidth, video.videoHeight);
}

/** Order 4 points as tl, tr, br, bl */
export function orderCorners(points) {
  if (points.length !== 4) return null;

  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return {
    tl: top[0],
    tr: top[1],
    bl: bottom[0],
    br: bottom[1],
  };
}

/** Fallback corners with optional detected merge */
export function resolveCaptureCorners(detected, width, height) {
  if (detected?.tl && detected?.tr && detected?.br && detected?.bl) {
    return { corners: detected, liveDetected: true };
  }
  return { corners: defaultCorners(width, height), liveDetected: false };
}

/** True if corners match default inset (live detect likely missed) */
export function isDefaultCorners(corners, width, height, marginRatio = 0.06) {
  if (!corners || !width || !height) return true;
  const def = defaultCorners(width, height, marginRatio);
  const keys = ['tl', 'tr', 'br', 'bl'];
  const tolerance = Math.max(width, height) * 0.02;
  return keys.every(
    (k) =>
      Math.abs(corners[k].x - def[k].x) <= tolerance &&
      Math.abs(corners[k].y - def[k].y) <= tolerance
  );
}

/**
 * Layout for object-fit: cover video in container
 */
export function getVideoCoverLayout(containerW, containerH, videoW, videoH) {
  const scale = Math.max(containerW / videoW, containerH / videoH);
  const drawW = videoW * scale;
  const drawH = videoH * scale;
  return {
    scale,
    offsetX: (containerW - drawW) / 2,
    offsetY: (containerH - drawH) / 2,
    drawW,
    drawH,
  };
}

export function videoPointToDisplay(point, layout) {
  return {
    x: layout.offsetX + point.x * layout.scale,
    y: layout.offsetY + point.y * layout.scale,
  };
}

export function cornersToDisplayPolygon(corners, layout) {
  if (!corners) return '';
  const keys = ['tl', 'tr', 'br', 'bl'];
  return keys
    .map((k) => {
      const p = videoPointToDisplay(corners[k], layout);
      return `${p.x},${p.y}`;
    })
    .join(' ');
}
