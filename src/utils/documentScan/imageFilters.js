/**
 * imageFilters.js — Document enhancement filters for scanned pages
 */

export const FILTER_IDS = ['original', 'auto', 'bw'];

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {'original'|'auto'|'bw'} filter
 */
export function applyFilter(ctx, width, height, filter) {
  if (filter === 'original') return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  if (filter === 'bw') {
    applyBlackAndWhite(data);
  } else if (filter === 'auto') {
    applyAutoEnhance(data);
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyBlackAndWhite(data) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = gray > 128 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function applyAutoEnhance(data) {
  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }

  const range = Math.max(max - min, 1);

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const stretched = ((data[i + c] - min) / range) * 255;
      data[i + c] = clamp(stretched, 0, 255);
    }
  }

  // Mild sharpen via unsharp mask approximation
  sharpenInPlace(data, Math.round(Math.sqrt(data.length / 4)));
}

function sharpenInPlace(data, width) {
  const copy = new Uint8ClampedArray(data);
  const height = data.length / 4 / width;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[i + c];
        const neighbors =
          copy[((y - 1) * width + x) * 4 + c] +
          copy[((y + 1) * width + x) * 4 + c] +
          copy[(y * width + (x - 1)) * 4 + c] +
          copy[(y * width + (x + 1)) * 4 + c];
        const sharpened = center + (center - neighbors / 4) * 0.35;
        data[i + c] = clamp(Math.round(sharpened), 0, 255);
      }
    }
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
