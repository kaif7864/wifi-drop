/**
 * useAutoCapture.js — Auto-capture when document corners stay stable ~1s
 */

import { useEffect, useRef } from 'react';

const STABLE_MS = 1000;
const COOLDOWN_MS = 2500;
const STABLE_THRESHOLD = 40;

function cornersMovement(a, b) {
  if (!a || !b) return Infinity;
  const keys = ['tl', 'tr', 'br', 'bl'];
  return keys.reduce(
    (sum, k) => sum + Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y),
    0
  );
}

export function useAutoCapture({ enabled, detected, corners, onAutoCapture }) {
  const stableSinceRef = useRef(null);
  const lastCornersRef = useRef(null);
  const cooldownUntilRef = useRef(0);
  const cornersRef = useRef(corners);
  const onCaptureRef = useRef(onAutoCapture);

  cornersRef.current = corners;
  onCaptureRef.current = onAutoCapture;

  useEffect(() => {
    if (!enabled || !detected) {
      stableSinceRef.current = null;
      lastCornersRef.current = null;
      return undefined;
    }

    const tick = () => {
      const currentCorners = cornersRef.current;
      if (!currentCorners) return;
      if (Date.now() < cooldownUntilRef.current) return;

      const move = cornersMovement(currentCorners, lastCornersRef.current);
      if (lastCornersRef.current && move > STABLE_THRESHOLD) {
        lastCornersRef.current = currentCorners;
        stableSinceRef.current = Date.now();
        return;
      }

      if (!lastCornersRef.current) {
        lastCornersRef.current = currentCorners;
        stableSinceRef.current = Date.now();
        return;
      }

      if (
        stableSinceRef.current &&
        Date.now() - stableSinceRef.current >= STABLE_MS
      ) {
        cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
        stableSinceRef.current = null;
        lastCornersRef.current = null;
        onCaptureRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [enabled, detected]);
}
