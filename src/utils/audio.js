/**
 * client/src/utils/audio.js
 * Web Audio API synthesizer for instant zero-dependency notification chimes
 * Auto-unlocks AudioContext on user interaction for reliable sound playback across browsers.
 */

let sharedAudioCtx = null;

function initAudioContext() {
  if (sharedAudioCtx) return sharedAudioCtx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioCtx = new AudioCtx();
  return sharedAudioCtx;
}

// Global window event listener to unlock Web Audio API on first click/tap/keypress
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = initAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = sharedAudioCtx && sharedAudioCtx.state !== 'closed' ? sharedAudioCtx : new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playChime(ctx)).catch(() => playChime(ctx));
    } else {
      playChime(ctx);
    }
  } catch (e) {
    console.warn('[Audio Chime Error]:', e);
  }
}

function playChime(ctx) {
  try {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    const now = ctx.currentTime;
    // High-pitched pleasant double chime (E5 -> B5)
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.setValueAtTime(987.77, now + 0.1); // B5

    osc2.frequency.setValueAtTime(329.63, now);
    osc2.frequency.setValueAtTime(493.88, now + 0.1);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('[Chime Synth Error]:', e);
  }
}
