/**
 * perspectiveTransform.js
 * 4-corner perspective warp for document scanning
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ tl: Point, tr: Point, br: Point, bl: Point }} Corners */

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Default corners with small inset from image edges */
export function defaultCorners(imgWidth, imgHeight, marginRatio = 0.06) {
  const m = marginRatio;
  return {
    tl: { x: imgWidth * m, y: imgHeight * m },
    tr: { x: imgWidth * (1 - m), y: imgHeight * m },
    br: { x: imgWidth * (1 - m), y: imgHeight * (1 - m) },
    bl: { x: imgWidth * m, y: imgHeight * (1 - m) },
  };
}

export function getOutputDimensions(corners) {
  const width = Math.max(dist(corners.tl, corners.tr), dist(corners.bl, corners.br));
  const height = Math.max(dist(corners.tl, corners.bl), dist(corners.tr, corners.br));
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/**
 * Solve 3x3 homography (8 DOF) mapping dst → src for inverse sampling
 * @param {Point[]} src [tl, tr, br, bl]
 * @param {Point[]} dst [tl, tr, br, bl]
 */
function computeHomography(src, dst) {
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
    b.push(sx);
    A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
    b.push(sy);
  }

  const h = gaussianElimination(A, b);
  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1,
  ];
}

function gaussianElimination(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const div = M[col][col] || 1e-12;
    for (let j = col; j <= n; j++) M[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

function sampleBilinear(data, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const idx = (px, py) => {
    if (px < 0 || py < 0 || px >= width || py >= height) return [255, 255, 255, 255];
    const i = (py * width + px) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const c00 = idx(x0, y0);
  const c10 = idx(x1, y0);
  const c01 = idx(x0, y1);
  const c11 = idx(x1, y1);

  const out = [0, 0, 0, 255];
  for (let c = 0; c < 3; c++) {
    out[c] = Math.round(
      c00[c] * (1 - fx) * (1 - fy) +
      c10[c] * fx * (1 - fy) +
      c01[c] * (1 - fx) * fy +
      c11[c] * fx * fy
    );
  }
  return out;
}

/**
 * Warp source image/canvas using 4 corner points
 * @param {HTMLCanvasElement | HTMLImageElement} source
 * @param {Corners} corners
 * @returns {HTMLCanvasElement}
 */
export function warpPerspective(source, corners) {
  const srcCanvas = source instanceof HTMLCanvasElement
    ? source
    : imageToCanvas(source);

  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

  const { width: outW, height: outH } = getOutputDimensions(corners);
  const dstCorners = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  const srcPoints = [corners.tl, corners.tr, corners.br, corners.bl];
  const H = computeHomography(srcPoints, dstCorners);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  const outImage = outCtx.createImageData(outW, outH);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcPt = applyHomography(H, x, y);
      const rgba = sampleBilinear(srcData, sw, sh, srcPt.x, srcPt.y);
      const i = (y * outW + x) * 4;
      outImage.data[i] = rgba[0];
      outImage.data[i + 1] = rgba[1];
      outImage.data[i + 2] = rgba[2];
      outImage.data[i + 3] = 255;
    }
  }

  outCtx.putImageData(outImage, 0, 0);
  return outCanvas;
}

function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Scale canvas so longest edge <= maxEdge */
export function limitCanvasSize(canvas, maxEdge = 2000) {
  const { width, height } = canvas;
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return canvas;

  const scale = maxEdge / longest;
  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/** Map between image pixel coords and on-screen display coords (object-fit: contain) */
export function getImageLayout(containerW, containerH, imgW, imgH) {
  const scale = Math.min(containerW / imgW, containerH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return {
    scale,
    offsetX: (containerW - drawW) / 2,
    offsetY: (containerH - drawH) / 2,
    drawW,
    drawH,
  };
}

export function imageToDisplay(point, layout) {
  return {
    x: layout.offsetX + point.x * layout.scale,
    y: layout.offsetY + point.y * layout.scale,
  };
}

export function displayToImage(point, layout) {
  return {
    x: clamp((point.x - layout.offsetX) / layout.scale, 0, Infinity),
    y: clamp((point.y - layout.offsetY) / layout.scale, 0, Infinity),
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function clampCorners(corners, imgW, imgH) {
  const clampPt = (p) => ({
    x: clamp(p.x, 0, imgW),
    y: clamp(p.y, 0, imgH),
  });
  return {
    tl: clampPt(corners.tl),
    tr: clampPt(corners.tr),
    br: clampPt(corners.br),
    bl: clampPt(corners.bl),
  };
}
