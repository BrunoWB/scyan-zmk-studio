/**
 * WPM Simulator and Keystroke Analytics Service
 * Provides realistic typing simulation (0 stalled to 60 WPM) and sliding-window WPM tracking.
 */

export interface ClickerBurst {
  isStalled: boolean;
  targetWpm: number; // 0 if stalled, 12-60 if typing
  burstLength: number; // number of keys to type (0 if stalled)
  durationMs: number; // stall duration if stalled, or base keystroke interval
}

/**
 * Standard typist metric: 5 characters per word.
 * Interval in ms = (60,000 ms/min) / (targetWpm * 5 chars/word) = 12,000 / targetWpm.
 */
export function getKeystrokeIntervalMs(targetWpm: number, jitter = true): number {
  if (targetWpm <= 0) return 2000;
  const clampedWpm = Math.min(160, Math.max(5, targetWpm));
  const base = Math.round(12000 / clampedWpm);
  if (!jitter) return base;
  // Natural typing jitter (+-15%)
  const factor = 0.85 + Math.random() * 0.3;
  return Math.max(80, Math.round(base * factor));
}

/**
 * Determines the next simulation action for the random clicker:
 * either a typing burst (12 - 60 WPM) or a stalled pause (0 WPM).
 */
export function getNextClickerAction(wasStalled: boolean): ClickerBurst {
  // If we just finished a stall, we must type a burst.
  // If we just finished a burst, ~35% chance to stall, 65% chance to start another burst.
  const shouldStall = !wasStalled && Math.random() < 0.35;

  if (shouldStall) {
    // Stall: 0 WPM for 1800ms - 3500ms
    const duration = Math.round(1800 + Math.random() * 1700);
    return {
      isStalled: true,
      targetWpm: 0,
      burstLength: 0,
      durationMs: duration,
    };
  }

  // Typing burst: pick speed from 12 to 60 WPM
  // Realistic typing range: 12 - 60 WPM
  const targetWpm = Math.round(12 + Math.random() * 48);
  // Burst length: 4 to 15 keystrokes (like 1 to 3 words)
  const burstLength = Math.floor(4 + Math.random() * 12);
  const baseInterval = Math.round(12000 / targetWpm);

  return {
    isStalled: false,
    targetWpm,
    burstLength,
    durationMs: baseInterval,
  };
}

/**
 * Calculates current WPM from sliding window of keystroke timestamps.
 * Window: 2.5s.
 */
export function calculateTypingWpm(timestamps: number[], now = Date.now(), maxWindowMs = 2500): number {
  const recent = timestamps.filter(t => now - t <= maxWindowMs);
  if (recent.length < 2) {
    return 0;
  }
  const first = recent[0];
  const elapsedSec = (now - first) / 1000;
  const windowSec = Math.min(maxWindowMs / 1000, Math.max(0.6, elapsedSec));
  const intervals = recent.length - 1;
  // 5 chars per word: WPM = (intervals / 5) * (60 / windowSec)
  const calculated = Math.round((intervals / 5) * (60 / windowSec));
  return Math.max(0, Math.min(160, calculated));
}
