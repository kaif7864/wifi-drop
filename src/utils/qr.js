/**
 * client/src/utils/qr.js
 * Instant zero-latency client-side QR Code Data URL Generator
 */

import QRCode from 'qrcode';

export async function generateClientQR(url) {
  if (!url) return null;
  try {
    return await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Client QR generation error:', err);
    return null;
  }
}
