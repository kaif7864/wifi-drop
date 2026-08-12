/**

 * DocumentScanner.jsx

 * Full document scan flow: camera → crop → review → PDF export

 */



import { useState, useCallback, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { ScannerCamera } from './ScannerCamera';

import { ScannerCropEditor } from './ScannerCropEditor';

import { ScannerPageReview } from './ScannerPageReview';

import { ScannerExporting } from './ScannerExporting';

import { ScannerSuccess } from './ScannerSuccess';

import { defaultCorners } from '../../utils/documentScan/perspectiveTransform';

import {

  loadImageFromSource,

  processScanPage,

  canvasFromDataUrl,

} from '../../utils/documentScan/processScanPage';

import { buildScanPdfFile, formatFileSize } from '../../utils/documentScan/scanPdfBuilder';

import './DocumentScanner.css';



/** @typedef {'camera' | 'crop' | 'review' | 'exporting' | 'success'} ScannerStep */



let pageIdCounter = 0;

function nextPageId() {

  pageIdCounter += 1;

  return `page_${pageIdCounter}`;

}



export function DocumentScanner({ isOpen, onClose, onScanComplete }) {

  const [step, setStep] = useState('camera');

  const [pages, setPages] = useState([]);

  const [draft, setDraft] = useState(null);

  const [editingPageId, setEditingPageId] = useState(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [activePageIndex, setActivePageIndex] = useState(0);

  const [exportProgress, setExportProgress] = useState(0);

  const [resultFile, setResultFile] = useState(null);



  const pagesRef = useRef(pages);

  pagesRef.current = pages;



  const resetScanner = useCallback(() => {

    setStep('camera');

    setPages([]);

    setDraft(null);

    setEditingPageId(null);

    setIsProcessing(false);

    setActivePageIndex(0);

    setExportProgress(0);

    setResultFile(null);

  }, []);



  const handleClose = useCallback(() => {

    resetScanner();

    onClose?.();

  }, [onClose, resetScanner]);



  useEffect(() => {

    if (!isOpen) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => { document.body.style.overflow = prev; };

  }, [isOpen]);



  const openDraftFromCapture = useCallback(({

    dataUrl,

    width,

    height,

    canvas,

    detectedCorners,

  }) => {

    setEditingPageId(null);

    setDraft({

      sourceDataUrl: dataUrl,

      sourceCanvas: canvas,

      width,

      height,

      corners: detectedCorners || defaultCorners(width, height),

      filter: 'original',

    });

    setStep('crop');

  }, []);



  const openDraftFromFile = useCallback(async (file) => {

    try {

      const img = await loadImageFromSource(file);

      const canvas = document.createElement('canvas');

      canvas.width = img.naturalWidth;

      canvas.height = img.naturalHeight;

      canvas.getContext('2d').drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);



      openDraftFromCapture({

        dataUrl,

        width: canvas.width,

        height: canvas.height,

        canvas,

        detectedCorners: defaultCorners(canvas.width, canvas.height),

      });

    } catch (err) {

      console.warn('[DocumentScanner] Gallery import failed:', err.message);

    }

  }, [openDraftFromCapture]);



  const commitDraft = useCallback(async (goToReview = false) => {

    if (!draft?.sourceCanvas) return null;



    setIsProcessing(true);

    try {

      const processed = processScanPage(

        draft.sourceCanvas,

        draft.corners,

        draft.filter

      );



      const pageData = {

        filter: draft.filter,

        ...processed,

        rawSourceDataUrl: draft.sourceDataUrl,

        rawWidth: draft.width,

        rawHeight: draft.height,

        corners: draft.corners,

      };



      if (editingPageId) {

        setPages((prev) =>

          prev.map((p) => (p.id === editingPageId ? { ...p, ...pageData } : p))

        );

        setEditingPageId(null);

      } else {

        setPages((prev) => [...prev, { id: nextPageId(), ...pageData }]);

      }



      setDraft(null);

      setStep(goToReview ? 'review' : 'camera');

      if (!editingPageId) {

        setActivePageIndex(pagesRef.current.length);

      }

      return pageData;

    } catch (err) {

      console.error('[DocumentScanner] Process page failed:', err);

      return null;

    } finally {

      setIsProcessing(false);

    }

  }, [draft, editingPageId]);



  const handleRetake = () => {

    setDraft(null);

    setEditingPageId(null);

    setStep('camera');

  };



  const handleAddPage = async () => {

    await commitDraft(false);

  };



  const handleCropDone = async () => {

    await commitDraft(true);

  };



  const handleReviewPages = () => {

    if (pages.length > 0) setStep('review');

  };



  const handleCreatePdf = async () => {

    if (pages.length === 0) return;



    setStep('exporting');

    setExportProgress(10);



    try {

      setExportProgress(40);

      const file = await buildScanPdfFile(

        pages.map((p) => ({

          dataUrl: p.dataUrl,

          width: p.width,

          height: p.height,

        }))

      );

      setExportProgress(100);

      setResultFile(file);

      setStep('success');

    } catch (err) {

      console.error('[DocumentScanner] PDF export failed:', err);

      setStep('review');

    }

  };



  const handleAddToTray = () => {

    if (resultFile) {

      onScanComplete?.(resultFile);

    }

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



  const handleEditPage = useCallback(async (index) => {

    const page = pages[index];

    if (!page?.rawSourceDataUrl) return;



    try {

      const canvas = await canvasFromDataUrl(page.rawSourceDataUrl);

      setDraft({

        sourceDataUrl: page.rawSourceDataUrl,

        sourceCanvas: canvas,

        width: page.rawWidth,

        height: page.rawHeight,

        corners: page.corners || defaultCorners(page.rawWidth, page.rawHeight),

        filter: page.filter || 'original',

      });

      setEditingPageId(page.id);

      setActivePageIndex(index);

      setStep('crop');

    } catch (err) {

      console.warn('[DocumentScanner] Edit page failed:', err.message);

    }

  }, [pages]);



  const handleReorderPages = useCallback((fromIndex, toIndex) => {

    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;



    setPages((prev) => {

      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;

      const next = [...prev];

      const [item] = next.splice(fromIndex, 1);

      next.splice(toIndex, 0, item);

      return next;

    });



    setActivePageIndex((curr) => {

      if (curr === fromIndex) return toIndex;

      if (fromIndex < curr && toIndex >= curr) return curr - 1;

      if (fromIndex > curr && toIndex <= curr) return curr + 1;

      return curr;

    });

  }, []);



  const editingPageIndex = editingPageId

    ? pages.findIndex((p) => p.id === editingPageId)

    : -1;

  const cropPageNumber = editingPageIndex >= 0 ? editingPageIndex + 1 : pages.length + 1;



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

              <motion.div key="camera" style={{ display: 'contents' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                <ScannerCamera

                  isActive={isOpen && step === 'camera'}

                  pageCount={pages.length}

                  onCapture={openDraftFromCapture}

                  onImportImage={openDraftFromFile}

                  onReviewPages={handleReviewPages}

                  onClose={handleClose}

                />

              </motion.div>

            )}



            {step === 'crop' && draft && (

              <motion.div key="crop" style={{ display: 'contents' }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>

                <ScannerCropEditor

                  pageNumber={cropPageNumber}

                  isEditing={editingPageIndex >= 0}

                  sourceDataUrl={draft.sourceDataUrl}

                  sourceCanvas={draft.sourceCanvas}

                  imageWidth={draft.width}

                  imageHeight={draft.height}

                  corners={draft.corners}

                  onCornersChange={(corners) => setDraft((d) => ({ ...d, corners }))}

                  activeFilter={draft.filter}

                  onFilterChange={(filter) => setDraft((d) => ({ ...d, filter }))}

                  onRetake={handleRetake}

                  onAddPage={handleAddPage}

                  onDone={handleCropDone}

                  isProcessing={isProcessing}

                />

              </motion.div>

            )}



            {step === 'review' && pages.length > 0 && (

              <motion.div key="review" style={{ display: 'contents' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>

                <ScannerPageReview

                  pages={pages}

                  activePageIndex={activePageIndex}

                  onSelectPage={setActivePageIndex}

                  onDeletePage={handleDeletePage}

                  onEditPage={handleEditPage}

                  onReorderPages={handleReorderPages}

                  onAddPage={() => setStep('camera')}

                  onBack={() => setStep('camera')}

                  onCreatePdf={handleCreatePdf}

                />

              </motion.div>

            )}



            {step === 'exporting' && (

              <motion.div key="exporting" style={{ display: 'contents' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                <ScannerExporting progress={exportProgress} />

              </motion.div>

            )}



            {step === 'success' && resultFile && (

              <motion.div key="success" style={{ display: 'contents' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>

                <ScannerSuccess

                  pageCount={pages.length}

                  fileName={resultFile.name}

                  fileSize={formatFileSize(resultFile.size)}

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


