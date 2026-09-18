import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OledPowerMetricsBar } from '../OledPowerMetricsBar';
import {
  calculatePowerEstimation,
  getPowerRating,
  type ScreenPixelStats,
} from '../../../services/powerEstimation';

describe('OledPowerMetricsBar component', () => {
  const mockStats: ScreenPixelStats = {
    currentLitPixels: 280,
    minLitPixels: 240,
    maxLitPixels: 320,
    avgLitPixels: 280,
    totalPixels: 4096,
    currentFillPct: (280 / 4096) * 100, // 6.8%
    minFillPct: (240 / 4096) * 100, // 5.9%
    maxFillPct: (320 / 4096) * 100, // 7.8%
    avgFillPct: (280 / 4096) * 100, // 6.8%
  };

  const estimation = calculatePowerEstimation(mockStats, {
    refreshRateHz: 1.0,
    hasAnimation: false,
    batteryCapacityMah: 110,
    screenKind: 'active',
  });

  it('renders summary bar with values and units only (X px%, clean Hz, rating) without titles', () => {
    const html = renderToString(
      <OledPowerMetricsBar
        estimation={estimation}
        screenKind="active"
        side="left"
        isCompact={false}
      />
    );

    expect(html).toContain('oled-power-metrics-bar');
    expect(html).toContain('data-testid="oled-power-metrics-bar"');
    // Pixel fill value and unit: "X px%" with no "Fill (avg)" title
    expect(html).toContain('6.8 px%');
    expect(html).not.toContain('Fill (avg)');
    expect(html).not.toContain('>Fill<');
    // Clean refresh rate without "Rate" title or "Hz 1.0 Hz" duplication
    expect(html).toContain('1.0 Hz');
    expect(html).not.toContain('>Rate<');
    expect(html).not.toMatch(/>\s*Hz\s*<.*1\.0 Hz/s);
    // Rating
    expect(html).toContain(estimation.rating.label);
  });

  it('does not render when isCompact is true', () => {
    const html = renderToString(
      <OledPowerMetricsBar
        estimation={estimation}
        screenKind="idle"
        side="left"
        isCompact={true}
      />
    );

    expect(html).not.toContain('oled-power-metrics-bar');
  });

  it('renders rating badge across all efficiency tiers', () => {
    const tiers = [
      { current: 1.5, expectedLabel: 'Ultra' },
      { current: 3.5, expectedLabel: 'Great' },
      { current: 6.0, expectedLabel: 'Good' },
      { current: 10.0, expectedLabel: 'Moderate' },
      { current: 18.0, expectedLabel: 'Heavy' },
    ];

    for (const { current, expectedLabel } of tiers) {
      const rating = getPowerRating(current);
      const customEst = {
        ...estimation,
        avgTotalMa: current,
        rating,
      };

      const html = renderToString(
        <OledPowerMetricsBar
          estimation={customEst}
          screenKind="active"
          side="left"
          isCompact={false}
        />
      );

      expect(html).toContain(expectedLabel);
    }
  });

  it('formats animated refresh rate cleanly at ~6.7 Hz', () => {
    const animEst = calculatePowerEstimation(mockStats, {
      refreshRateHz: 6.67,
      hasAnimation: true,
    });

    const html = renderToString(
      <OledPowerMetricsBar
        estimation={animEst}
        screenKind="active"
        side="left"
        isCompact={false}
      />
    );

    expect(html).toContain('6.7 Hz');
    expect(html).not.toContain('>Rate<');
  });

  it('provides accessible button role, click-to-toggle indicator, and descriptive aria label', () => {
    const html = renderToString(
      <OledPowerMetricsBar
        estimation={estimation}
        screenKind="active"
        side="left"
        isCompact={false}
      />
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="OLED Power and Display Metrics. Click to toggle breakdown."');
    expect(html).toContain('tabindex="0"');
  });
});
