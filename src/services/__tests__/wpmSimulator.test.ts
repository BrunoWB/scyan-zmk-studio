import { describe, it, expect } from 'vitest';
import {
  getKeystrokeIntervalMs,
  getNextClickerAction,
  calculateTypingWpm,
} from '../wpmSimulator';

describe('wpmSimulator service', () => {
  describe('getKeystrokeIntervalMs', () => {
    it('calculates correct base interval for standard WPM targets without jitter', () => {
      // 60 WPM: 12000 / 60 = 200ms
      expect(getKeystrokeIntervalMs(60, false)).toBe(200);
      // 30 WPM: 12000 / 30 = 400ms
      expect(getKeystrokeIntervalMs(30, false)).toBe(400);
      // 15 WPM: 12000 / 15 = 800ms
      expect(getKeystrokeIntervalMs(15, false)).toBe(800);
      // 10 WPM: 12000 / 10 = 1200ms
      expect(getKeystrokeIntervalMs(10, false)).toBe(1200);
    });

    it('clamps 0 or negative WPM to default fallback', () => {
      expect(getKeystrokeIntervalMs(0, false)).toBe(2000);
      expect(getKeystrokeIntervalMs(-10, false)).toBe(2000);
    });

    it('applies realistic jitter within +-20% bounds', () => {
      for (let i = 0; i < 50; i++) {
        const interval = getKeystrokeIntervalMs(60, true);
        // Base is 200ms, factor 0.85 to 1.15 => 170ms to 230ms (with min clamp 80ms)
        expect(interval).toBeGreaterThanOrEqual(160);
        expect(interval).toBeLessThanOrEqual(245);
      }
    });
  });

  describe('getNextClickerAction', () => {
    it('always generates a typing burst immediately after a stall', () => {
      for (let i = 0; i < 30; i++) {
        const action = getNextClickerAction(true);
        expect(action.isStalled).toBe(false);
        expect(action.targetWpm).toBeGreaterThanOrEqual(12);
        expect(action.targetWpm).toBeLessThanOrEqual(60);
        expect(action.burstLength).toBeGreaterThanOrEqual(4);
        expect(action.burstLength).toBeLessThanOrEqual(15);
        expect(action.durationMs).toBeGreaterThan(0);
      }
    });

    it('can produce both typing bursts and stalls when coming from an active burst', () => {
      let sawStall = false;
      let sawBurst = false;

      for (let i = 0; i < 100; i++) {
        const action = getNextClickerAction(false);
        if (action.isStalled) {
          sawStall = true;
          expect(action.targetWpm).toBe(0);
          expect(action.burstLength).toBe(0);
          expect(action.durationMs).toBeGreaterThanOrEqual(1800);
          expect(action.durationMs).toBeLessThanOrEqual(3600);
        } else {
          sawBurst = true;
          expect(action.targetWpm).toBeGreaterThanOrEqual(12);
          expect(action.targetWpm).toBeLessThanOrEqual(60);
          expect(action.burstLength).toBeGreaterThanOrEqual(4);
        }
      }

      expect(sawStall).toBe(true);
      expect(sawBurst).toBe(true);
    });
  });

  describe('calculateTypingWpm', () => {
    it('returns 0 when there are fewer than 2 keystrokes in window', () => {
      expect(calculateTypingWpm([])).toBe(0);
      expect(calculateTypingWpm([1000], 1500)).toBe(0);
    });

    it('calculates accurate WPM for steady 60 WPM keystrokes (200ms interval)', () => {
      // 60 WPM = 1 key every 200ms
      const now = 2000;
      const timestamps = [
        now - 1400,
        now - 1200,
        now - 1000,
        now - 800,
        now - 600,
        now - 400,
        now - 200,
        now,
      ];
      const wpm = calculateTypingWpm(timestamps, now);
      // 8 keys = 7 intervals over 1.4s => (7 / 5) * (60 / 1.4) = 1.4 * 42.85 = 60 WPM
      expect(wpm).toBe(60);
    });

    it('calculates accurate WPM for steady 30 WPM keystrokes (400ms interval)', () => {
      const now = 2000;
      const timestamps = [
        now - 1600,
        now - 1200,
        now - 800,
        now - 400,
        now,
      ];
      const wpm = calculateTypingWpm(timestamps, now);
      // 5 keys = 4 intervals over 1.6s => (4 / 5) * (60 / 1.6) = 0.8 * 37.5 = 30 WPM
      expect(wpm).toBe(30);
    });

    it('calculates accurate WPM for slow 10 WPM keystrokes (1200ms interval)', () => {
      const now = 2400;
      const timestamps = [
        now - 2400,
        now - 1200,
        now,
      ];
      const wpm = calculateTypingWpm(timestamps, now);
      // 3 keys = 2 intervals over 2.4s => (2 / 5) * (60 / 2.4) = 0.4 * 25 = 10 WPM
      expect(wpm).toBe(10);
    });

    it('filters out stale keystrokes older than maxWindowMs', () => {
      const now = 5000;
      const timestamps = [
        100, 200, 300, // old keystrokes > 2500ms ago
        now - 400,
        now,
      ];
      const wpm = calculateTypingWpm(timestamps, now, 2500);
      expect(wpm).toBeGreaterThan(0);
    });
  });
});
