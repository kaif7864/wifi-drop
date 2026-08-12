/**
 * opencvLoader.js — Lazy-load OpenCV.js from CDN (browser-safe, no Vite bundling)
 */

const OPENCV_CDN = 'https://docs.opencv.org/4.9.0/opencv.js';
const INIT_TIMEOUT_MS = 30000;

let cvPromise = null;

export function loadOpenCV() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenCV requires a browser environment'));
  }

  if (window.cv?.Mat) {
    return Promise.resolve(window.cv);
  }

  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-opencv-loader]');

    if (existing) {
      // Script tag already in DOM — don't wait for 'load' (may have fired already)
      if (window.cv?.Mat) {
        resolve(window.cv);
        return;
      }
      waitForCv(resolve, reject);
      return;
    }

    const script = document.createElement('script');
    script.src = OPENCV_CDN;
    script.async = true;
    script.defer = true;
    script.dataset.opencvLoader = 'true';
    script.onload = () => waitForCv(resolve, reject);
    script.onerror = () => {
      cvPromise = null;
      reject(new Error('Failed to load OpenCV'));
    };
    document.head.appendChild(script);
  });

  return cvPromise;
}

function waitForCv(resolve, reject) {
  const cv = window.cv;
  if (!cv) {
    cvPromise = null;
    reject(new Error('OpenCV global not found'));
    return;
  }
  if (cv.Mat) {
    resolve(cv);
    return;
  }

  let settled = false;
  const finish = (fn) => {
    if (settled) return;
    settled = true;
    fn();
  };

  cv.onRuntimeInitialized = () => finish(() => resolve(cv));

  setTimeout(() => {
    if (window.cv?.Mat) {
      finish(() => resolve(window.cv));
    } else {
      cvPromise = null;
      finish(() => reject(new Error('OpenCV init timeout')));
    }
  }, INIT_TIMEOUT_MS);
}

/** Fire-and-forget preload — only call when camera is confirmed working */
export function preloadOpenCV() {
  if (window.cv?.Mat) return;
  loadOpenCV().catch(() => {});
}

export function isOpenCVReady() {
  return Boolean(window.cv?.Mat);
}
