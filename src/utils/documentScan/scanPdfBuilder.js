/**
 * scanPdfBuilder.js — Merge processed scan pages into a single PDF File
 */

const MAX_PAGES = 20;
const JPEG_QUALITY = 0.88;

/**
 * @param {{ dataUrl: string, width: number, height: number }[]} pages
 * @returns {Promise<File>}
 */
export async function buildScanPdfFile(pages) {
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
    const orientation = width >= height ? 'landscape' : 'portrait';

    if (i === 0) {
      pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height],
        compress: true,
      });
    } else {
      pdf.addPage([width, height], orientation);
    }

    pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height, undefined, 'FAST');
  }

  const blob = pdf.output('blob');
  const fileName = generateScanFileName();

  return new File([blob], fileName, { type: 'application/pdf' });
}

export function generateScanFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `scan_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { MAX_PAGES, JPEG_QUALITY };
