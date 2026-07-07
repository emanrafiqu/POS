/**
 * Tiny WebAudio beeps — no audio assets required.
 * Used by the QR scanner (success/error) and checkout confirmation.
 */
let ctx;

function play(frequency, duration = 0.15, type = 'sine', volume = 0.2) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio not available — ignore */
  }
}

export function playSuccessSound() {
  play(880, 0.12);
  setTimeout(() => play(1320, 0.15), 90);
}

export function playErrorSound() {
  play(220, 0.25, 'square', 0.12);
}
