/**
 * scanPdfBuilder.js — Merge processed scan pages into a single PDF File
 */

const MAX_PAGES = 20;
const JPEG_QUALITY = 0.82;
const PDF_MAX_EDGE = 1200; // keep scanned PDFs smaller for mobile upload

function limitEdge(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * @param {{ dataUrl: string, width: number, height: number }[]} pages
 * @param {string} [customName]
 * @returns {Promise<File>}
 */
export async function buildScanPdfFile(pages, customName) {
  if (!pages?.length) {
    throw new Error('No pages to export');
  }
  if (pages.length > MAX_PAGES) {
    throw new Error(`Maximum ${MAX_PAGES} pages per scan`);
  }

  const { jsPDF } = await import('jspdf');

  let pdf = null;

  for (let i = 0; i < pages.length; i++) {
    const { dataUrl, width, height } = pages[i];
    const sized = limitEdge(width, height, PDF_MAX_EDGE);
    const orientation = sized.width >= sized.height ? 'landscape' : 'portrait';

    if (i === 0) {
      pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [sized.width, sized.height],
        compress: true,
      });
    } else {
      pdf.addPage([sized.width, sized.height], orientation);
    }

    pdf.addImage(dataUrl, 'JPEG', 0, 0, sized.width, sized.height, undefined, 'FAST');
  }

  const blob = pdf.output('blob');
  const fileName = customName ? `${customName.replace(/\.pdf$/i, '')}.pdf` : generateScanFileName('pdf');

  return new File([blob], fileName, { type: 'application/pdf' });
}

/**
 * Convert pages to a JPEG File
 * @param {{ dataUrl: string, width: number, height: number }[]} pages
 * @param {string} [customName]
 * @returns {Promise<File>}
 */
export async function buildScanJpgFile(pages, customName) {
  if (!pages?.length) {
    throw new Error('No pages to export');
  }
  
  // Use first page or canvas merge
  const firstPage = pages[0];
  const response = await fetch(firstPage.dataUrl);
  const blob = await response.blob();
  const fileName = customName ? `${customName.replace(/\.jpg$/i, '')}.jpg` : generateScanFileName('jpg');

  return new File([blob], fileName, { type: 'image/jpeg' });
}

export function generateScanFileName(ext = 'pdf') {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `scan_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { MAX_PAGES, JPEG_QUALITY };
