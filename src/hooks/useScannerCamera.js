/**
 * useScannerCamera.js — getUserMedia lifecycle (no setState loops)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const GET_USER_MEDIA_TIMEOUT_MS = 12000;

function stopTracks(streamRef, videoRef) {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
}

async function attachStreamToVideo(stream, video) {
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  await video.play();
}

export function useScannerCamera(isActive) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pendingAttachRef = useRef(false);
  const sessionRef = useRef(0);

  const [facingMode, setFacingMode] = useState('environment');
  const [retryToken, setRetryToken] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const tryAttachPendingStream = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || pendingAttachRef.current) return false;

    pendingAttachRef.current = true;
    try {
      await attachStreamToVideo(stream, video);
      setReady(true);
      setError(null);

      const track = stream.getVideoTracks?.()[0];
      if (track?.getCapabilities) {
        try {
          setTorchAvailable(Boolean(track.getCapabilities().torch));
        } catch {
          setTorchAvailable(false);
        }
      }
      return true;
    } catch (err) {
      console.warn('[useScannerCamera] Video attach failed:', err.message);
      return false;
    } finally {
      pendingAttachRef.current = false;
    }
  }, []);

  // Callback ref — attach stream as soon as <video> mounts
  const setVideoRef = useCallback(
    (node) => {
      videoRef.current = node;
      if (node && streamRef.current) {
        tryAttachPendingStream();
      }
    },
    [tryAttachPendingStream]
  );

  useEffect(() => {
    if (!isActive) {
      sessionRef.current += 1;
      stopTracks(streamRef, videoRef);
      setReady(false);
      setError(null);
      setTorchOn(false);
      setTorchAvailable(false);
      return undefined;
    }

    const session = ++sessionRef.current;
    let aborted = false;

    const fail = (message) => {
      if (aborted || session !== sessionRef.current) return;
      stopTracks(streamRef, videoRef);
      setReady(false);
      setError(message);
    };

    const run = async () => {
      setError(null);
      setReady(false);
      stopTracks(streamRef, videoRef);

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        fail('Camera requires HTTPS — use gallery import 🖼️ or open via https://');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        fail('Camera not supported — import from gallery 🖼️');
        return;
      }

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(Object.assign(new Error('Camera timeout'), { name: 'AbortError' })),
          GET_USER_MEDIA_TIMEOUT_MS
        );
      });

      try {
        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          }),
          timeoutPromise,
        ]);

        clearTimeout(timeoutId);

        if (aborted || session !== sessionRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          pendingAttachRef.current = true;
          try {
            await attachStreamToVideo(stream, video);
            if (aborted || session !== sessionRef.current) return;
            setReady(true);
            const track = stream.getVideoTracks?.()[0];
            if (track?.getCapabilities) {
              try {
                setTorchAvailable(Boolean(track.getCapabilities().torch));
              } catch {
                setTorchAvailable(false);
              }
            }
          } finally {
            pendingAttachRef.current = false;
          }
        }
        // If video not mounted yet, setVideoRef callback will attach when it mounts
      } catch (err) {
        clearTimeout(timeoutId);
        if (aborted || session !== sessionRef.current) return;

        if (err.name === 'AbortError') {
          fail('Camera timed out — allow permission or use gallery 🖼️');
          return;
        }

        const msg =
          err.name === 'NotAllowedError'
            ? 'Camera permission denied — allow access in browser settings'
            : err.name === 'NotFoundError'
            ? 'No camera found — use gallery import 🖼️'
            : err.message || 'Could not start camera';
        fail(msg);
      }
    };

    run();

    return () => {
      aborted = true;
      stopTracks(streamRef, videoRef);
    };
  }, [isActive, facingMode, retryToken]);

  const flipCamera = useCallback(() => {
    setTorchOn(false);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  const retry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;

    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      try {
        await track.applyConstraints({ torch: next });
        setTorchOn(next);
      } catch {
        setTorchAvailable(false);
      }
    }
  }, [torchOn]);

  return {
    videoRef: setVideoRef,
    ready,
    error,
    flipCamera,
    retry,
    torchOn,
    torchAvailable,
    toggleTorch,
  };
}
