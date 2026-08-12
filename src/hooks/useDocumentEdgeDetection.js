/**
 * useDocumentEdgeDetection.js — Live auto-detect document edges on camera feed
 * OpenCV loads ONLY when camera is ready (avoids blocking page when camera unavailable)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadOpenCV } from '../utils/documentScan/opencvLoader';
import { detectFromVideo } from '../utils/documentScan/edgeDetection';

const DETECT_INTERVAL_MS = 450;

export function useDocumentEdgeDetection(videoRef, isActive, ready, cameraError) {
  const [corners, setCorners] = useState(null);
  const [opencvReady, setOpencvReady] = useState(false);
  const [opencvLoading, setOpencvLoading] = useState(false);
  const [opencvFailed, setOpencvFailed] = useState(false);
  const [detected, setDetected] = useState(false);
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);

  const shouldLoadCv = isActive && ready && !cameraError;

  // Load OpenCV only after camera stream is live
  useEffect(() => {
    cancelledRef.current = false;

    if (!isActive) {
      setCorners(null);
      setDetected(false);
      setOpencvFailed(false);
      setOpencvReady(false);
      setOpencvLoading(false);
      return undefined;
    }

    if (!shouldLoadCv) {
      setOpencvLoading(false);
      return undefined;
    }

    setOpencvLoading(true);
    setOpencvFailed(false);

    loadOpenCV()
      .then(() => {
        if (cancelledRef.current) return;
        setOpencvReady(true);
        setOpencvLoading(false);
      })
      .catch(() => {
        if (cancelledRef.current) return;
        setOpencvReady(false);
        setOpencvLoading(false);
        setOpencvFailed(true);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [isActive, shouldLoadCv]);

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !ready || !opencvReady || busyRef.current || cameraError) return;

    busyRef.current = true;
    try {
      const result = await detectFromVideo(video);
      if (cancelledRef.current) return;
      if (result) {
        setCorners(result);
        setDetected(true);
      } else {
        setDetected(false);
      }
    } catch {
      if (!cancelledRef.current) setDetected(false);
    } finally {
      busyRef.current = false;
    }
  }, [videoRef, ready, opencvReady, cameraError]);

  // Sequential detect loop (no overlapping OpenCV work on main thread)
  useEffect(() => {
    if (!isActive || !ready || !opencvReady || cameraError) {
      return undefined;
    }

    cancelledRef.current = false;
    let timeoutId;

    const loop = async () => {
      if (cancelledRef.current) return;
      await runDetection();
      if (!cancelledRef.current) {
        timeoutId = setTimeout(loop, DETECT_INTERVAL_MS);
      }
    };

    loop();

    return () => {
      cancelledRef.current = true;
      clearTimeout(timeoutId);
    };
  }, [isActive, ready, opencvReady, cameraError, runDetection]);

  return {
    corners,
    detected,
    opencvReady,
    opencvLoading,
    opencvFailed,
  };
}
