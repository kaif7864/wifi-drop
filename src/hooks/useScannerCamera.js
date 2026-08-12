/**
 * useScannerCamera.js — getUserMedia lifecycle for document scanner
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function useScannerCamera(isActive) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setReady(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setError(null);
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setReady(true);
      }
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera permission denied — allow camera access in browser settings'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device'
          : err.message || 'Could not start camera';
      setError(msg);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!isActive) {
      stopStream();
      return stopStream;
    }
    startStream();
    return stopStream;
  }, [isActive, facingMode, startStream, stopStream]);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  return {
    videoRef,
    ready,
    error,
    flipCamera,
    retry: startStream,
  };
}
