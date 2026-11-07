// ============================================================================
// lib/utils/audio.ts — Zero-Dependency Synthetic Web Audio Chime Synthesizer
// ============================================================================

/**
 * Synthetic dual-tone chime using the Web Audio API.
 * Tone 1: Note D5 (587.33Hz) for 150ms
 * Tone 2: Note A5 (880.00Hz) for 300ms
 * Zero external MP3/WAV files.
 */

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  return globalAudioCtx;
}

/**
 * Checks if the AudioContext is initialized and in 'running' state.
 */
export function isAudioUnlocked(): boolean {
  const ctx = getAudioContext();
  return !!ctx && ctx.state === 'running';
}

/**
 * Unlocks the Web Audio context upon the first user interaction gesture.
 */
export async function unlockAudioContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  } catch (err) {
    console.warn('[audio] Failed to resume AudioContext:', err);
    return false;
  }
}

/**
 * Plays the synthetic dual-tone order notification chime:
 * D5 (587.33Hz) for 150ms -> A5 (880Hz) for 300ms.
 */
export function playOrderChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // If suspended, try to resume (works if triggered during user event)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (ctx.state !== 'running') {
    console.warn('[audio] AudioContext is not running. User gesture required to unlock.');
    return;
  }

  const now = ctx.currentTime;

  try {
    // -------------------------------------------------------------
    // Tone 1: Note D5 (587.33 Hz) for 150ms
    // -------------------------------------------------------------
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    // Attack and decay envelope
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.16);

    // -------------------------------------------------------------
    // Tone 2: Note A5 (880.00 Hz) for 300ms (rings out cleanly)
    // -------------------------------------------------------------
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle'; // Richer harmonic bell sound
    osc2.frequency.setValueAtTime(880.0, now + 0.15);

    gain2.gain.setValueAtTime(0.001, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.15);
    osc2.stop(now + 0.46);
  } catch (err) {
    console.error('[audio] Error synthesizing chime:', err);
  }
}
