/**
 * Audio feedback utility for barcode scanning and notifications.
 * Uses Web Audio API for zero-latency, offline, crisp POS scanner beeps.
 */

export function playScanBeep() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // In some mobile browsers, AudioContext starts suspended until user interaction
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Classic crisp POS barcode scanner beep: 1900 Hz sine wave
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, ctx.currentTime);

    // Short, crisp volume envelope (120ms)
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);

    // Clean up AudioContext to prevent memory/resource leaks
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 300);
  } catch (err) {
    console.warn('Web Audio scan beep error:', err);
  }
}
