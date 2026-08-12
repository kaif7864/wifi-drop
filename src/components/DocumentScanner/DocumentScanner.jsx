/**
 * DocumentScanner.jsx
 * Adobe Scan-style fullscreen document scanner — UI shell with step navigation
 * Logic (camera, crop, PDF) wired in later; UI-only for now
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScannerCamera } from './ScannerCamera';
import { ScannerCropEditor } from './ScannerCropEditor';
import { ScannerPageReview } from './ScannerPageReview';
import { ScannerExporting } from './ScannerExporting';
import { ScannerSuccess } from './ScannerSuccess';
import './DocumentScanner.css';

/** @typedef {'camera' | 'crop' | 'review' | 'exporting' | 'success'} ScannerStep */

let pageIdCounter = 0;
function createPage(filter = 'original') {
  pageIdCounter += 1;
  return { id: `page_${pageIdCounter}`, filter };
}

function mockPdfFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `scan_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
}

export function DocumentScanner({ isOpen, onClose, onScanComplete }) {
  /** @type {[ScannerStep, Function]} */
  const [step, setStep] = useState('camera');
  const [pages, setPages] = useState([]);
  const [activeFilter, setActiveFilter] = useState('original');
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [resultMeta, setResultMeta] = useState({ fileName: '', fileSize: '—' });

  const resetScanner = useCallback(() => {
    setStep('camera');
    setPages([]);
    setActiveFilter('original');
    setActivePageIndex(0);
    setExportProgress(0);
    setResultMeta({ fileName: '', fileSize: '—' });
  }, []);

  const handleClose = useCallback(() => {
    resetScanner();
    onClose?.();
  }, [onClose, resetScanner]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const handleCapture = () => setStep('crop');

  const handleRetake = () => setStep('camera');

  const handleAddPage = () => {
    const newPage = createPage(activeFilter);
    setPages((prev) => [...prev, newPage]);
    setStep('camera');
  };

  const handleCropDone = () => {
    const newPage = createPage(activeFilter);
    setPages((prev) => [...prev, newPage]);
    setStep('review');
    setActivePageIndex(pages.length);
  };

  const handleReviewPages = () => setStep('review');

  const handleCreatePdf = () => {
    setStep('exporting');
    setExportProgress(0);

    // Mock export animation
    let p = 0;
    const interval = setInterval(() => {
      p += 12;
      setExportProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(interval);
        const fileName = mockPdfFileName();
        const mockSize = `${(pages.length * 180 + 120).toFixed(0)} KB`;
        setResultMeta({ fileName, fileSize: mockSize });
        setStep('success');
      }
    }, 180);
  };

  const handleAddToTray = () => {
    // UI-only: mock File placeholder for parent integration later
    onScanComplete?.({
      fileName: resultMeta.fileName,
      pageCount: pages.length,
      mock: true,
    });
    handleClose();
  };

  const handleDeletePage = (index) => {
    setPages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setStep('camera');
        return [];
      }
      setActivePageIndex((curr) => Math.min(curr, next.length - 1));
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="doc-scanner-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {step === 'camera' && (
              <motion.div
                key="camera"
                style={{ display: 'contents' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ScannerCamera
                  pageCount={pages.length}
                  onCapture={handleCapture}
                  onReviewPages={handleReviewPages}
                  onClose={handleClose}
                />
              </motion.div>
            )}

            {step === 'crop' && (
              <motion.div
                key="crop"
                style={{ display: 'contents' }}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
              >
                <ScannerCropEditor
                  pageNumber={pages.length + 1}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  onRetake={handleRetake}
                  onAddPage={() => {
                    const newPage = createPage(activeFilter);
                    setPages((prev) => [...prev, newPage]);
                    setStep('camera');
                  }}
                  onDone={handleCropDone}
                />
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div
                key="review"
                style={{ display: 'contents' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ScannerPageReview
                  pages={pages.length > 0 ? pages : [createPage()]}
                  activePageIndex={activePageIndex}
                  onSelectPage={setActivePageIndex}
                  onDeletePage={handleDeletePage}
                  onAddPage={() => setStep('camera')}
                  onBack={() => setStep('camera')}
                  onCreatePdf={handleCreatePdf}
                />
              </motion.div>
            )}

            {step === 'exporting' && (
              <motion.div
                key="exporting"
                style={{ display: 'contents' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ScannerExporting progress={exportProgress} />
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                style={{ display: 'contents' }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <ScannerSuccess
                  pageCount={pages.length}
                  fileName={resultMeta.fileName}
                  fileSize={resultMeta.fileSize}
                  onAddToTray={handleAddToTray}
                  onScanMore={resetScanner}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
