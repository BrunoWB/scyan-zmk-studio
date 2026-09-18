import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import {
  renderBlocksToGrid,
  normalizeWidgetType,
  resolveWidgetInstance,
} from './widgetRegistry';

/**
 * Constants based on OLED SSD1306 electrical analysis on Corne (nice_nano_v2 @ 3.3V).
 */
export const POWER_CONSTANTS = {
  DEFAULT_BATTERY_CAPACITY_MAH: 110,
  SUPPLY_VOLTAGE_V: 3.3,
  // Baseline SSD1306 quiescent controller + MCU sleep
  BASELINE_CURRENT_MA: 1.55,
  // Diode current per lit pixel at 3.3V (~11.7 uA / pixel)
  DIODE_CURRENT_PER_PIXEL_MA: 0.0117,
  // Saturation clamping under 100% white saturation of 4096 pixels
  MAX_DIODE_CURRENT_CLAMP_MA: 22.0,
  // Screen refresh cost: Full blit/transform + I2C EasyDMA transfer takes ~56.2 ms @ ~2.8 mA above sleep (~0.1575 mA*s per event)
  REFRESH_COST_MA_S: 0.1575,
  // Standard refresh rate for active screens with no animation (due to firmware heartbeat / WPM ticker)
  STANDARD_ACTIVE_REFRESH_HZ: 1.0,
  // Default animation loop tick rate (~150 ms interval)
  ANIMATION_DEFAULT_REFRESH_HZ: 6.67,
  // Static idle screen refresh rate
  IDLE_STATIC_REFRESH_HZ: 0.0,
  // Factoring in typical wireless keyboard duty cycle: 20% active typing, 80% deep sleep/off
  TYPICAL_ACTIVE_DUTY_CYCLE: 0.20,
  // Controller deep sleep current (display off command 0xAE)
  DEEP_SLEEP_CURRENT_MA: 0.05,
} as const;

export type PowerRatingTier = 'ultra' | 'great' | 'good' | 'moderate' | 'heavy';

export interface PowerRating {
  tier: PowerRatingTier;
  label: string;
  badgeColor: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  iconName: 'zap' | 'check-circle' | 'gauge' | 'alert-triangle' | 'flame';
  description: string;
}

export interface ScreenPixelStats {
  currentLitPixels: number;
  minLitPixels: number;
  maxLitPixels: number;
  avgLitPixels: number;
  totalPixels: number;
  currentFillPct: number;
  minFillPct: number;
  maxFillPct: number;
  avgFillPct: number;
}

export interface PowerEstimationResult {
  stats: ScreenPixelStats;
  refreshRateHz: number;
  hasAnimation: boolean;
  refreshReason: string;
  // Current components in mA
  baselineCurrentMa: number;
  refreshCurrentMa: number;
  currentDiodeCurrentMa: number;
  avgDiodeCurrentMa: number;
  minDiodeCurrentMa: number;
  maxDiodeCurrentMa: number;
  // Total current draws in mA
  currentTotalMa: number;
  avgTotalMa: number;
  minTotalMa: number;
  maxTotalMa: number;
  // Energy consumption rates
  energyMahPerMin: number;
  energyMwhPerMin: number;
  energyJoulesPerMin: number;
  powerMw: number;
  // Battery endurance
  batteryCapacityMah: number;
  continuousLifeHours: number;
  continuousLifeDays: number;
  expectedLifeHours: number;
  expectedLifeDays: number;
  // Efficiency rating
  rating: PowerRating;
}

/**
 * Maps total current in mA to an efficiency rating tier, icon, and explanation.
 */
export function getPowerRating(totalCurrentMa: number): PowerRating {
  if (totalCurrentMa < 2.0) {
    return {
      tier: 'ultra',
      label: 'Ultra',
      badgeColor: '#10b981',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
      bgColor: 'bg-emerald-500/10',
      iconName: 'zap',
      description: '< 2.0 mA — Ultra-low diode draw. Maximum wireless battery life.',
    };
  }
  if (totalCurrentMa < 4.5) {
    return {
      tier: 'great',
      label: 'Great',
      badgeColor: '#38bdf8',
      textColor: 'text-sky-400',
      borderColor: 'border-sky-500/30',
      bgColor: 'bg-sky-500/10',
      iconName: 'check-circle',
      description: '2.0 – 4.5 mA — Optimal efficiency for clean static layouts.',
    };
  }
  if (totalCurrentMa < 8.0) {
    return {
      tier: 'good',
      label: 'Good',
      badgeColor: '#fbbf24',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      bgColor: 'bg-amber-500/10',
      iconName: 'gauge',
      description: '4.5 – 8.0 mA — Balanced layout with moderate widget fill.',
    };
  }
  if (totalCurrentMa < 14.0) {
    return {
      tier: 'moderate',
      label: 'Moderate',
      badgeColor: '#fb923c',
      textColor: 'text-orange-400',
      borderColor: 'border-orange-500/30',
      bgColor: 'bg-orange-500/10',
      iconName: 'alert-triangle',
      description: '8.0 – 14.0 mA — Noticeable drain from dense graphics or animations.',
    };
  }
  return {
    tier: 'heavy',
    label: 'Heavy',
    badgeColor: '#f43f5e',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgColor: 'bg-rose-500/10',
    iconName: 'flame',
    description: '> 14.0 mA — Heavy power draw. Battery will drain rapidly.',
  };
}

/**
 * Calculates diode current with hardware saturation clamping.
 * Clamps at 22.0 mA for standard 4096-pixel (32x128) Corne OLED, scaled proportionally for custom dimensions.
 */
export function calculateDiodeCurrentMa(litPixels: number, totalPixels: number = 4096): number {
  if (litPixels <= 0) return 0;
  const rawCurrent = litPixels * POWER_CONSTANTS.DIODE_CURRENT_PER_PIXEL_MA;
  const scale = Math.max(1, totalPixels) / 4096;
  const maxClamp = POWER_CONSTANTS.MAX_DIODE_CURRENT_CLAMP_MA * scale;
  return Math.min(rawCurrent, maxClamp);
}

/**
 * Calculates screen refresh cost in average mA.
 */
export function calculateRefreshCurrentMa(refreshRateHz: number): number {
  if (refreshRateHz <= 0) return 0;
  return refreshRateHz * POWER_CONSTANTS.REFRESH_COST_MA_S;
}

/**
 * Detects whether screen has animated blocks and determines expected refresh rate.
 * For idle screens, keystroke-driven widgets like Bongo remain static (0 Hz); only autonomous loop/duck animations tick.
 */
export function detectScreenRefresh(
  blocks: LayoutBlock[],
  screenKind: 'active' | 'idle' = 'active',
  instances?: WidgetInstanceMap
): { hasAnimation: boolean; refreshRateHz: number; reason: string } {
  const enabledBlocks = blocks.filter(b => b.enabled);
  let highestAnimHz = 0;
  let hasAnimation = false;

  for (const b of enabledBlocks) {
    const normType = normalizeWidgetType(b.widgetType || b.id);
    if (normType === 'animation' || normType === 'loop') {
      hasAnimation = true;
      const inst = resolveWidgetInstance(instances, 'animation', b.instanceId) || resolveWidgetInstance(instances, 'loop', b.instanceId);
      const loopSpeedMs = inst?.config?.loopSpeedMs;
      const hz = loopSpeedMs && loopSpeedMs > 0 ? 1000 / loopSpeedMs : POWER_CONSTANTS.ANIMATION_DEFAULT_REFRESH_HZ;
      if (hz > highestAnimHz) highestAnimHz = hz;
    } else if (normType === 'bongo' && screenKind !== 'idle') {
      // Bongo is keystroke-driven; on active screens typing triggers paw animations (~6.67 Hz)
      hasAnimation = true;
      if (POWER_CONSTANTS.ANIMATION_DEFAULT_REFRESH_HZ > highestAnimHz) {
        highestAnimHz = POWER_CONSTANTS.ANIMATION_DEFAULT_REFRESH_HZ;
      }
    }
  }

  if (hasAnimation) {
    const rate = Math.round((highestAnimHz || POWER_CONSTANTS.ANIMATION_DEFAULT_REFRESH_HZ) * 100) / 100;
    return {
      hasAnimation: true,
      refreshRateHz: rate,
      reason: `Animation loop ticker (${rate.toFixed(1)} Hz)`,
    };
  }

  if (screenKind === 'idle') {
    return {
      hasAnimation: false,
      refreshRateHz: POWER_CONSTANTS.IDLE_STATIC_REFRESH_HZ,
      reason: 'Static idle screen (0 Hz)',
    };
  }

  return {
    hasAnimation: false,
    refreshRateHz: POWER_CONSTANTS.STANDARD_ACTIVE_REFRESH_HZ,
    reason: 'Standard active heartbeat ticker (1.0 Hz)',
  };
}

/**
 * Counts lit pixels strictly within display bounds.
 */
export function countGridPixelsWithinBounds(grid: BwpxGrid, width: number, height: number): number {
  let count = 0;
  grid.forEachPixel((x, y) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      count++;
    }
  });
  return count;
}

/**
 * Evaluates min, max, avg, and current lit pixels across animation frames and dynamic states.
 */
export function computeScreenPixelStats(
  blocks: LayoutBlock[],
  options: {
    width: number;
    height: number;
    symbolsGrid: BwpxGrid;
    symbolSlices: SpriteSlice[];
    fontGrid: BwpxGrid;
    fontGlyphs?: FontGlyph[];
    fontMappings?: FontCharMapping[];
    customText?: string;
    instances?: WidgetInstanceMap;
    side?: string;
    currentVbuf?: BwpxGrid;
    layerNames?: string[];
    screenKind?: 'active' | 'idle';
  }
): ScreenPixelStats {
  const {
    width,
    height,
    symbolsGrid,
    symbolSlices,
    fontGrid,
    fontGlyphs = [],
    fontMappings = [],
    customText = '',
    instances,
    side = 'left',
    currentVbuf,
    layerNames = ['DEFAULT', 'LOWER', 'RAISE', 'ADJUST'],
    screenKind = 'active',
  } = options;

  const totalPixels = Math.max(1, width * height);

  // Measure current lit pixels
  let currentLitPixels = 0;
  if (currentVbuf) {
    currentLitPixels = countGridPixelsWithinBounds(currentVbuf, width, height);
  } else {
    const vbuf = new BwpxGrid(width, height);
    renderBlocksToGrid(blocks, vbuf, {
      symbolsGrid,
      symbolSlices,
      fontGrid,
      fontGlyphs,
      fontMappings,
      battery: 85,
      outputMode: 'usb',
      currentLayer: 0,
      layerNames,
      wpm: screenKind === 'idle' ? 0 : 68,
      splitConnected: true,
      customText,
      side,
      instances,
      bongoState: screenKind === 'idle' ? 0 : 1,
      animationTimestamp: 0,
    });
    currentLitPixels = countGridPixelsWithinBounds(vbuf, width, height);
  }

  // Detect animation or multi-frame sources
  const enabledBlocks = blocks.filter(b => b.enabled);
  const animBlock = enabledBlocks.find(b => {
    const t = normalizeWidgetType(b.widgetType || b.id);
    return t === 'animation' || t === 'loop';
  });
  const bongoBlock = enabledBlocks.find(b => normalizeWidgetType(b.widgetType || b.id) === 'bongo');

  const samplePixelCounts: number[] = [];

  if (animBlock) {
    const inst = resolveWidgetInstance(instances, 'animation', animBlock.instanceId) || resolveWidgetInstance(instances, 'loop', animBlock.instanceId);
    const speedMs = Math.max(20, inst?.config?.loopSpeedMs ?? 150);
    const targetGroupId = inst?.config?.groupId;
    let frameCount = 4;
    if (targetGroupId) {
      const groupSlices = symbolSlices.filter(s => s.groupId === targetGroupId || s.groupId.toLowerCase() === targetGroupId.toLowerCase());
      if (groupSlices.length > 0) frameCount = Math.min(16, groupSlices.length);
    }

    for (let f = 0; f < frameCount; f++) {
      const tempBuf = new BwpxGrid(width, height);
      renderBlocksToGrid(blocks, tempBuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery: 85,
        outputMode: 'usb',
        currentLayer: 0,
        layerNames,
        wpm: screenKind === 'idle' ? 0 : 68,
        splitConnected: true,
        customText,
        side,
        instances,
        bongoState: screenKind === 'idle' ? 0 : 1,
        animationTimestamp: f * speedMs,
      });
      samplePixelCounts.push(countGridPixelsWithinBounds(tempBuf, width, height));
    }
  } else if (bongoBlock && screenKind !== 'idle') {
    // Active screen: sample bongo's 3 states: 0 (idle), 1 (left paw), 2 (right paw)
    for (let state = 0; state < 3; state++) {
      const tempBuf = new BwpxGrid(width, height);
      renderBlocksToGrid(blocks, tempBuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery: 85,
        outputMode: 'usb',
        currentLayer: 0,
        layerNames,
        wpm: state === 0 ? 0 : 68,
        splitConnected: true,
        customText,
        side,
        instances,
        bongoState: state as 0 | 1 | 2,
      });
      samplePixelCounts.push(countGridPixelsWithinBounds(tempBuf, width, height));
    }
  } else {
    // Static or semi-dynamic widgets (e.g. battery, layer, wpm)
    // Sample state 1: Current preview state
    samplePixelCounts.push(currentLitPixels);

    if (screenKind === 'idle') {
      // Idle screen: WPM is 0, bongo is resting
      const idleLowBuf = new BwpxGrid(width, height);
      renderBlocksToGrid(blocks, idleLowBuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery: 20,
        outputMode: 'usb',
        currentLayer: 0,
        layerNames,
        wpm: 0,
        splitConnected: true,
        customText,
        side,
        instances,
        bongoState: 0,
      });
      samplePixelCounts.push(countGridPixelsWithinBounds(idleLowBuf, width, height));
    } else {
      // Sample state 2: Low dynamic state (low battery, 0 WPM)
      const lowBuf = new BwpxGrid(width, height);
      renderBlocksToGrid(blocks, lowBuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery: 15,
        outputMode: 'usb',
        currentLayer: 0,
        layerNames,
        wpm: 0,
        splitConnected: true,
        customText,
        side,
        instances,
      });
      samplePixelCounts.push(countGridPixelsWithinBounds(lowBuf, width, height));

      // Sample state 3: High dynamic state (full battery, 100 WPM, layer 1)
      const highBuf = new BwpxGrid(width, height);
      renderBlocksToGrid(blocks, highBuf, {
        symbolsGrid,
        symbolSlices,
        fontGrid,
        fontGlyphs,
        fontMappings,
        battery: 100,
        outputMode: 'usb',
        currentLayer: 1,
        layerNames,
        wpm: 100,
        splitConnected: true,
        customText,
        side,
        instances,
      });
      samplePixelCounts.push(countGridPixelsWithinBounds(highBuf, width, height));
    }
  }

  const minLitPixels = Math.min(...samplePixelCounts);
  const maxLitPixels = Math.max(...samplePixelCounts);
  const avgLitPixels = Math.round(samplePixelCounts.reduce((acc, c) => acc + c, 0) / samplePixelCounts.length);

  return {
    currentLitPixels,
    minLitPixels,
    maxLitPixels,
    avgLitPixels,
    totalPixels,
    currentFillPct: (currentLitPixels / totalPixels) * 100,
    minFillPct: (minLitPixels / totalPixels) * 100,
    maxFillPct: (maxLitPixels / totalPixels) * 100,
    avgFillPct: (avgLitPixels / totalPixels) * 100,
  };
}

/**
 * Calculates full power analysis, current breakdowns, battery life, and ratings.
 */
export function calculatePowerEstimation(
  stats: ScreenPixelStats,
  options: {
    refreshRateHz: number;
    hasAnimation: boolean;
    refreshReason?: string;
    batteryCapacityMah?: number;
    screenKind?: 'active' | 'idle';
  }
): PowerEstimationResult {
  const {
    refreshRateHz,
    hasAnimation,
    refreshReason = hasAnimation ? `Animation (${refreshRateHz.toFixed(1)} Hz)` : `${refreshRateHz.toFixed(1)} Hz`,
    batteryCapacityMah = POWER_CONSTANTS.DEFAULT_BATTERY_CAPACITY_MAH,
    screenKind: _screenKind = 'active',
  } = options;

  const baselineCurrentMa = POWER_CONSTANTS.BASELINE_CURRENT_MA;
  const refreshCurrentMa = calculateRefreshCurrentMa(refreshRateHz);

  const currentDiodeCurrentMa = calculateDiodeCurrentMa(stats.currentLitPixels, stats.totalPixels);
  const avgDiodeCurrentMa = calculateDiodeCurrentMa(stats.avgLitPixels, stats.totalPixels);
  const minDiodeCurrentMa = calculateDiodeCurrentMa(stats.minLitPixels, stats.totalPixels);
  const maxDiodeCurrentMa = calculateDiodeCurrentMa(stats.maxLitPixels, stats.totalPixels);

  const currentTotalMa = baselineCurrentMa + refreshCurrentMa + currentDiodeCurrentMa;
  const avgTotalMa = baselineCurrentMa + refreshCurrentMa + avgDiodeCurrentMa;
  const minTotalMa = baselineCurrentMa + refreshCurrentMa + minDiodeCurrentMa;
  const maxTotalMa = baselineCurrentMa + refreshCurrentMa + maxDiodeCurrentMa;

  // Energy consumption rates
  // Power P = V * I (mW)
  const powerMw = POWER_CONSTANTS.SUPPLY_VOLTAGE_V * avgTotalMa;
  // mAh per minute = mA / 60
  const energyMahPerMin = avgTotalMa / 60;
  // mWh per minute = (V * mA) / 60
  const energyMwhPerMin = powerMw / 60;
  // Joules per minute = (P_watts) * 60 = (mW * 0.001) * 60 = mW * 0.06
  const energyJoulesPerMin = powerMw * 0.06;

  // Battery life calculations
  // Continuous life: Screen always ON continuously
  const continuousLifeHours = avgTotalMa > 0 ? batteryCapacityMah / avgTotalMa : 0;
  const continuousLifeDays = continuousLifeHours / 24;

  // Expected real life:
  // Typical wireless keyboard duty cycle: 20% active typing, 80% deep sleep/off (display off @ 0.05 mA)
  const dutyCycle = POWER_CONSTANTS.TYPICAL_ACTIVE_DUTY_CYCLE;
  const effectiveAverageMa = dutyCycle * avgTotalMa + (1 - dutyCycle) * POWER_CONSTANTS.DEEP_SLEEP_CURRENT_MA;
  const expectedLifeHours = effectiveAverageMa > 0 ? batteryCapacityMah / effectiveAverageMa : 0;
  const expectedLifeDays = expectedLifeHours / 24;

  const rating = getPowerRating(avgTotalMa);

  return {
    stats,
    refreshRateHz,
    hasAnimation,
    refreshReason,
    baselineCurrentMa,
    refreshCurrentMa,
    currentDiodeCurrentMa,
    avgDiodeCurrentMa,
    minDiodeCurrentMa,
    maxDiodeCurrentMa,
    currentTotalMa,
    avgTotalMa,
    minTotalMa,
    maxTotalMa,
    energyMahPerMin,
    energyMwhPerMin,
    energyJoulesPerMin,
    powerMw,
    batteryCapacityMah,
    continuousLifeHours,
    continuousLifeDays,
    expectedLifeHours,
    expectedLifeDays,
    rating,
  };
}

/**
 * Format helpers for displaying values cleanly.
 */
export function formatFillPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function formatPixelFill(pct: number): string {
  return `${pct.toFixed(1)} px%`;
}

export function formatCurrent(ma: number): string {
  return `${ma.toFixed(2)} mA`;
}

export function formatRefreshRate(hz: number): string {
  return `${hz.toFixed(1)} Hz`;
}

export function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0 h';
  if (hours < 24) {
    return `${hours.toFixed(1)} h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} d (${Math.round(hours)}h)`;
}
