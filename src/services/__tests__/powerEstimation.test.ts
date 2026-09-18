import { describe, it, expect } from 'vitest';
import {
  calculateDiodeCurrentMa,
  calculateRefreshCurrentMa,
  getPowerRating,
  calculatePowerEstimation,
  detectScreenRefresh,
  formatDurationHours,
  formatPixelFill,
  POWER_CONSTANTS,
  type ScreenPixelStats,
} from '../powerEstimation';
import type { LayoutBlock } from '../../types/zmk';

describe('powerEstimation service', () => {
  describe('calculateDiodeCurrentMa', () => {
    it('returns 0 for 0 or negative lit pixels', () => {
      expect(calculateDiodeCurrentMa(0)).toBe(0);
      expect(calculateDiodeCurrentMa(-10)).toBe(0);
    });

    it('calculates linear diode current at 11.7 uA per pixel', () => {
      // 100 pixels * 0.0117 mA = 1.17 mA
      expect(calculateDiodeCurrentMa(100)).toBeCloseTo(1.17, 4);
      // 500 pixels * 0.0117 mA = 5.85 mA
      expect(calculateDiodeCurrentMa(500)).toBeCloseTo(5.85, 4);
    });

    it('clamps current to MAX_DIODE_CURRENT_CLAMP_MA (22.0 mA) under high saturation', () => {
      // 4096 pixels * 0.0117 = 47.92 mA -> clamped to 22.0 mA
      expect(calculateDiodeCurrentMa(4096)).toBe(POWER_CONSTANTS.MAX_DIODE_CURRENT_CLAMP_MA);
      expect(calculateDiodeCurrentMa(10000)).toBe(POWER_CONSTANTS.MAX_DIODE_CURRENT_CLAMP_MA);
    });

    it('scales saturation clamp proportionally for custom screen dimensions', () => {
      // 128x64 display (8192 pixels): clamp is 22.0 * (8192 / 4096) = 44.0 mA
      expect(calculateDiodeCurrentMa(8192, 8192)).toBe(44.0);
      expect(calculateDiodeCurrentMa(10000, 8192)).toBe(44.0);
    });
  });

  describe('calculateRefreshCurrentMa', () => {
    it('returns 0 for 0 Hz', () => {
      expect(calculateRefreshCurrentMa(0)).toBe(0);
    });

    it('calculates refresh cost for 1.0 Hz heartbeat', () => {
      // 1.0 * 0.1575 = 0.1575 mA
      expect(calculateRefreshCurrentMa(1.0)).toBeCloseTo(0.1575, 4);
    });

    it('calculates refresh cost for 6.67 Hz animation', () => {
      // 6.67 * 0.1575 ≈ 1.05 mA
      expect(calculateRefreshCurrentMa(6.67)).toBeCloseTo(1.0505, 3);
    });
  });

  describe('getPowerRating', () => {
    it('returns Ultra tier for current < 2.0 mA', () => {
      const rating = getPowerRating(1.85);
      expect(rating.tier).toBe('ultra');
      expect(rating.label).toBe('Ultra');
      expect(rating.iconName).toBe('zap');
    });

    it('returns Great tier for current between 2.0 and 4.5 mA', () => {
      const rating = getPowerRating(3.2);
      expect(rating.tier).toBe('great');
      expect(rating.label).toBe('Great');
      expect(rating.iconName).toBe('check-circle');
    });

    it('returns Good tier for current between 4.5 and 8.0 mA', () => {
      const rating = getPowerRating(6.5);
      expect(rating.tier).toBe('good');
      expect(rating.label).toBe('Good');
      expect(rating.iconName).toBe('gauge');
    });

    it('returns Moderate tier for current between 8.0 and 14.0 mA', () => {
      const rating = getPowerRating(11.0);
      expect(rating.tier).toBe('moderate');
      expect(rating.label).toBe('Moderate');
      expect(rating.iconName).toBe('alert-triangle');
    });

    it('returns Heavy tier for current >= 14.0 mA', () => {
      const rating = getPowerRating(18.5);
      expect(rating.tier).toBe('heavy');
      expect(rating.label).toBe('Heavy');
      expect(rating.iconName).toBe('flame');
    });
  });

  describe('detectScreenRefresh', () => {
    it('returns 1.0 Hz for active screen without animations', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Battery', widgetType: 'battery', x: 0, y: 0, width: 32, height: 16, enabled: true, side: 'left' },
        { id: 'b2', name: 'Layer', widgetType: 'layer-banner', x: 0, y: 20, width: 32, height: 16, enabled: true, side: 'left' },
      ];
      const res = detectScreenRefresh(blocks, 'active');
      expect(res.hasAnimation).toBe(false);
      expect(res.refreshRateHz).toBe(1.0);
    });

    it('returns 0.0 Hz for idle screen without animations', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Branding', widgetType: 'branding', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left' },
      ];
      const res = detectScreenRefresh(blocks, 'idle');
      expect(res.hasAnimation).toBe(false);
      expect(res.refreshRateHz).toBe(0.0);
    });

    it('detects bongo animation on active screen and sets ~6.67 Hz', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Bongo', widgetType: 'bongo', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left' },
      ];
      const res = detectScreenRefresh(blocks, 'active');
      expect(res.hasAnimation).toBe(true);
      expect(res.refreshRateHz).toBeCloseTo(6.67, 2);
    });

    it('treats bongo on idle screen as static (0 Hz) because keyboard is not typing', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Bongo', widgetType: 'bongo', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left' },
      ];
      const res = detectScreenRefresh(blocks, 'idle');
      expect(res.hasAnimation).toBe(false);
      expect(res.refreshRateHz).toBe(0.0);
    });

    it('detects autonomous loop animation on idle screen and preserves refresh rate', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Loop Anim', widgetType: 'loop', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left', instanceId: 'loop1' },
      ];
      const instances = {
        loop: [
          { id: 'loop1', widgetTypeId: 'loop', label: 'Idle Duck', config: { loopSpeedMs: 200 }, slots: {} },
        ],
      };
      const res = detectScreenRefresh(blocks, 'idle', instances as any);
      expect(res.hasAnimation).toBe(true);
      expect(res.refreshRateHz).toBe(5.0); // 1000 / 200 ms = 5 Hz
    });

    it('detects animation widget and custom loop speed if configured', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Animation', widgetType: 'animation', x: 0, y: 0, width: 32, height: 32, enabled: true, side: 'left', instanceId: 'inst1' },
      ];
      const instances = {
        animation: [
          { id: 'inst1', widgetTypeId: 'animation', label: 'Fast Anim', config: { loopSpeedMs: 100 }, slots: {} },
        ],
      };
      const res = detectScreenRefresh(blocks, 'active', instances as any);
      expect(res.hasAnimation).toBe(true);
      expect(res.refreshRateHz).toBe(10.0); // 1000 / 100 ms = 10 Hz
    });

    it('ignores disabled animation blocks', () => {
      const blocks: LayoutBlock[] = [
        { id: 'b1', name: 'Disabled Anim', widgetType: 'animation', x: 0, y: 0, width: 32, height: 32, enabled: false, side: 'left' },
      ];
      const res = detectScreenRefresh(blocks, 'active');
      expect(res.hasAnimation).toBe(false);
      expect(res.refreshRateHz).toBe(1.0);
    });
  });

  describe('calculatePowerEstimation', () => {
    const mockStats: ScreenPixelStats = {
      currentLitPixels: 300,
      minLitPixels: 250,
      maxLitPixels: 350,
      avgLitPixels: 300,
      totalPixels: 4096,
      currentFillPct: (300 / 4096) * 100,
      minFillPct: (250 / 4096) * 100,
      maxFillPct: (350 / 4096) * 100,
      avgFillPct: (300 / 4096) * 100,
    };

    it('computes correct baseline, refresh, and diode current components', () => {
      const result = calculatePowerEstimation(mockStats, {
        refreshRateHz: 1.0,
        hasAnimation: false,
      });

      expect(result.baselineCurrentMa).toBe(1.55);
      expect(result.refreshCurrentMa).toBeCloseTo(0.1575, 4);
      // Diode for 300 px: 300 * 0.0117 = 3.51 mA
      expect(result.avgDiodeCurrentMa).toBeCloseTo(3.51, 4);
      // Total avg: 1.55 + 0.1575 + 3.51 = 5.2175 mA
      expect(result.avgTotalMa).toBeCloseTo(5.2175, 3);
      expect(result.rating.tier).toBe('good');
    });

    it('computes energy consumption rates per minute', () => {
      const result = calculatePowerEstimation(mockStats, {
        refreshRateHz: 1.0,
        hasAnimation: false,
      });

      // avgTotalMa ≈ 5.2175 mA
      // energyMahPerMin = 5.2175 / 60 ≈ 0.08696 mAh/min
      expect(result.energyMahPerMin).toBeCloseTo(5.2175 / 60, 4);
      // Power = 3.3 * 5.2175 ≈ 17.218 mW
      expect(result.powerMw).toBeCloseTo(3.3 * 5.2175, 2);
      expect(result.energyMwhPerMin).toBeCloseTo((3.3 * 5.2175) / 60, 4);
    });

    it('computes continuous battery life and expected real-life accurately', () => {
      const result = calculatePowerEstimation(mockStats, {
        refreshRateHz: 1.0,
        hasAnimation: false,
        batteryCapacityMah: 110,
      });

      // Continuous life = 110 / 5.2175 ≈ 21.08 hours
      expect(result.continuousLifeHours).toBeCloseTo(110 / result.avgTotalMa, 2);

      // Expected real life = 110 / (0.2 * 5.2175 + 0.8 * 0.05) = 110 / (1.0435 + 0.04) = 110 / 1.0835 ≈ 101.5 hours
      const effectiveDailyMa = 0.2 * result.avgTotalMa + 0.8 * 0.05;
      expect(result.expectedLifeHours).toBeCloseTo(110 / effectiveDailyMa, 1);
      expect(result.expectedLifeDays).toBeCloseTo(result.expectedLifeHours / 24, 2);
    });

    it('handles blank/empty screen gracefully (0 lit pixels)', () => {
      const blankStats: ScreenPixelStats = {
        currentLitPixels: 0,
        minLitPixels: 0,
        maxLitPixels: 0,
        avgLitPixels: 0,
        totalPixels: 4096,
        currentFillPct: 0,
        minFillPct: 0,
        maxFillPct: 0,
        avgFillPct: 0,
      };

      const result = calculatePowerEstimation(blankStats, {
        refreshRateHz: 1.0,
        hasAnimation: false,
      });

      // Total = 1.55 + 0.1575 = 1.7075 mA (< 2.0 mA -> Ultra)
      expect(result.avgTotalMa).toBeCloseTo(1.7075, 4);
      expect(result.rating.tier).toBe('ultra');
      expect(result.continuousLifeHours).toBeCloseTo(110 / 1.7075, 1);
      expect(result.expectedLifeDays).toBeGreaterThan(10);
    });
  });

  describe('formatDurationHours', () => {
    it('formats under 24 hours in hours', () => {
      expect(formatDurationHours(14.5)).toBe('14.5 h');
    });

    it('formats 24 hours or greater in days with rounded hours', () => {
      expect(formatDurationHours(72)).toBe('3.0 d (72h)');
      expect(formatDurationHours(101.5)).toBe('4.2 d (102h)');
    });

    it('handles zero and edge cases', () => {
      expect(formatDurationHours(0)).toBe('0 h');
      expect(formatDurationHours(-5)).toBe('0 h');
      expect(formatDurationHours(Infinity)).toBe('0 h');
    });
  });

  describe('formatPixelFill', () => {
    it('formats fill percentage as X px%', () => {
      expect(formatPixelFill(6.834)).toBe('6.8 px%');
      expect(formatPixelFill(12.0)).toBe('12.0 px%');
      expect(formatPixelFill(0)).toBe('0.0 px%');
      expect(formatPixelFill(100)).toBe('100.0 px%');
    });
  });
});
