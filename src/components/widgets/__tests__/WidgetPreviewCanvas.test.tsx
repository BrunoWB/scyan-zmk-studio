import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  WidgetPreviewCanvas,
  computePreviewDimensions,
  renderWidgetPreviewToGrid,
} from '../WidgetPreviewCanvas';
import { BwpxGrid } from '../../../pixel/core/PixelGrid';
import { WIDGET_REGISTRY, getWidgetDefinition } from '../../../services/widgetRegistry';
import type { SpriteSlice } from '../../../types/zmk';
import type { WidgetInstance } from '../../../types/widget';

describe('WidgetPreviewCanvas component & pure functions', () => {
  const dummyGrid = new BwpxGrid(32, 128);
  const testSlices: SpriteSlice[] = [
    { id: 'SYMBOL_BATTERY_FRAME', groupId: 'BATTERY', groupOrder: 1, name: 'Battery', x: 0, y: 0, width: 17, height: 10, color: '#fff' },
    { id: 'SYMBOL_BATTERY_1', groupId: 'BATTERY', groupOrder: 2, name: 'Battery Full', x: 0, y: 10, width: 17, height: 10, color: '#fff' },
    { id: 'SYMBOL_USB', groupId: 'SYMBOL_USB', groupOrder: 1, name: 'USB Plug', x: 0, y: 20, width: 12, height: 10, color: '#fff' },
    { id: 'SYMBOL_SPLIT_CONNECTED', groupId: 'SPLIT', groupOrder: 1, name: 'Split', x: 0, y: 30, width: 13, height: 9, color: '#fff' },
    { id: 'SYMBOL_CAPS_LOCK', groupId: 'CAPS', groupOrder: 1, name: 'Caps', x: 0, y: 40, width: 16, height: 16, color: '#fff' },
    { id: 'SYMBOL_MASCOT_1', groupId: 'MASCOT', groupOrder: 1, name: 'Mascot', x: 0, y: 60, width: 26, height: 26, color: '#fff' },
  ];

  it('renders a canvas element with pixelated imageRendering style', () => {
    const batteryDef = getWidgetDefinition('battery')!;
    const html = renderToString(
      <WidgetPreviewCanvas
        widget={batteryDef}
        symbolsGrid={dummyGrid}
        symbolSlices={testSlices}
        fontGrid={dummyGrid}
        mode="thumb"
      />
    );

    expect(html).toContain('<canvas');
    expect(html).toContain('class="pixel-preview-canvas"');
    expect(html).toContain('image-rendering:pixelated');
  });

  describe('computePreviewDimensions', () => {
    it('bounds screensaver height to compact thumbnail bounds in thumb mode (never 128px)', () => {
      const screensaverDef = getWidgetDefinition('screensaver')!;
      const dimsWithSlice = computePreviewDimensions(screensaverDef, 'thumb', { width: 26, height: 26 });
      expect(dimsWithSlice.width).toBe(26);
      expect(dimsWithSlice.height).toBe(26);
      expect(dimsWithSlice.scale).toBe(2);

      const dimsFallback = computePreviewDimensions(screensaverDef, 'thumb', { width: 32, height: 128 });
      expect(dimsFallback.width).toBe(32);
      expect(dimsFallback.height).toBeLessThanOrEqual(26);
      expect(dimsFallback.height).not.toBe(128);
    });

    it('bounds screensaver, animation, and typewriter height in instance mode (never 128px giant tower)', () => {
      const screensaverDef = getWidgetDefinition('screensaver')!;
      const dimsWithSlice = computePreviewDimensions(screensaverDef, 'instance', { width: 26, height: 26 });
      expect(dimsWithSlice.width).toBe(26);
      expect(dimsWithSlice.height).toBe(26);
      expect(dimsWithSlice.scale).toBe(3);

      const dimsFallback = computePreviewDimensions(screensaverDef, 'instance', { width: 32, height: 128 });
      expect(dimsFallback.width).toBe(32);
      expect(dimsFallback.height).toBeLessThanOrEqual(64);
      expect(dimsFallback.height).not.toBe(128);

      const twDef = getWidgetDefinition('typewriter')!;
      const twFallback = computePreviewDimensions(twDef, 'instance', { width: 32, height: 128 });
      expect(twFallback.height).toBeLessThanOrEqual(64);
    });

    it('calculates natural non-squished thumb dimensions for narrow status widgets', () => {
      const batteryDef = getWidgetDefinition('battery')!;
      const batThumb = computePreviewDimensions(batteryDef, 'thumb', { width: 17, height: 10 });
      expect(batThumb.width).toBe(17);
      expect(batThumb.height).toBe(10);
      expect(batThumb.scale).toBe(2);

      const connDef = getWidgetDefinition('connection')!;
      const connThumb = computePreviewDimensions(connDef, 'thumb', { width: 12, height: 10 });
      expect(connThumb.width).toBe(14); // Min bound 14
      expect(connThumb.height).toBe(10);
    });

    it('calculates proper instance mode dimensions for battery, connection, and caps-lock', () => {
      const batteryDef = getWidgetDefinition('battery')!;
      const batDims = computePreviewDimensions(batteryDef, 'instance', { width: 17, height: 10 });
      expect(batDims.width).toBe(17);
      expect(batDims.height).toBe(14);
      expect(batDims.scale).toBe(3);

      const connDef = getWidgetDefinition('connection')!;
      const connDims = computePreviewDimensions(connDef, 'instance', { width: 12, height: 10 });
      expect(connDims.width).toBe(14);
      expect(connDims.height).toBe(14);

      const capsDef = getWidgetDefinition('caps-lock')!;
      const capsDims = computePreviewDimensions(capsDef, 'instance', { width: 16, height: 16 });
      expect(capsDims.width).toBe(16);
      expect(capsDims.height).toBe(16);
    });
  });

  describe('renderWidgetPreviewToGrid', () => {
    it('passes destX = 0 and destY = 0 with blockWidth and blockHeight set to grid dimensions', () => {
      const batteryDef = getWidgetDefinition('battery')!;
      const renderSpy = vi.fn();
      const mockWidget = {
        ...batteryDef,
        render: renderSpy,
      };

      const grid = new BwpxGrid(17, 14);
      renderWidgetPreviewToGrid(mockWidget, grid, {
        symbolsGrid: dummyGrid,
        symbolSlices: testSlices,
        fontGrid: dummyGrid,
      });

      expect(renderSpy).toHaveBeenCalledWith(grid, 0, 0, expect.objectContaining({
        blockWidth: 17,
        blockHeight: 14,
      }));
    });

    it('renders battery slice centered without right-edge truncation', () => {
      // Create a symbolsGrid with a 17x10 battery bitmap
      const symbolsGrid = new BwpxGrid(32, 32);
      // Fill the battery pixels for both slices (y: 0..19)
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 17; x++) {
          symbolsGrid.set(x, y, 1);
        }
      }

      const batteryDef = getWidgetDefinition('battery')!;
      const grid = new BwpxGrid(17, 14);

      const batteryInstance: WidgetInstance = {
        id: 'bat-1',
        widgetTypeId: 'battery',
        label: 'Bat',
        config: { mode: 'symbol', groupId: 'BATTERY' },
        slots: {},
      };

      renderWidgetPreviewToGrid(batteryDef, grid, {
        symbolsGrid,
        symbolSlices: testSlices,
        fontGrid: dummyGrid,
        battery: 100,
        instances: { battery: [batteryInstance] },
        activeInstanceId: 'bat-1',
      });

      // The 17-wide battery should be drawn from x=0 to x=16 without right-side clipping
      // Y is centered in 14-high grid: (14-10)/2 = 2, so y=2..11
      for (let x = 0; x < 17; x++) {
        expect(grid.get(x, 2)).toBe(1);
        expect(grid.get(x, 11)).toBe(1);
      }
      // Out-of-slice Y rows should be 0
      expect(grid.get(0, 0)).toBe(0);
      expect(grid.get(0, 13)).toBe(0);
    });

    it('renders connection slice centered without right-edge truncation', () => {
      // 12x10 USB bitmap
      const symbolsGrid = new BwpxGrid(32, 32);
      for (let y = 20; y < 30; y++) {
        for (let x = 0; x < 12; x++) {
          symbolsGrid.set(x, y, 1);
        }
      }

      const connDef = getWidgetDefinition('connection')!;
      const grid = new BwpxGrid(14, 14);

      const connInstance: WidgetInstance = {
        id: 'conn-1',
        widgetTypeId: 'connection',
        label: 'USB',
        config: { mode: 'symbol', groupId: 'SYMBOL_USB' },
        slots: {},
      };

      renderWidgetPreviewToGrid(connDef, grid, {
        symbolsGrid,
        symbolSlices: testSlices,
        fontGrid: dummyGrid,
        outputMode: 'usb',
        instances: { connection: [connInstance] },
        activeInstanceId: 'conn-1',
      });

      // 12-wide USB centered in 14-wide grid: startX = (14-12)/2 = 1.
      // So x=1..12 is filled with 1, x=0 and x=13 are 0!
      expect(grid.get(0, 2)).toBe(0);
      expect(grid.get(1, 2)).toBe(1);
      expect(grid.get(12, 2)).toBe(1);
      expect(grid.get(13, 2)).toBe(0);
    });
  });

  it('renders all 13 registry widgets without error', () => {
    WIDGET_REGISTRY.forEach((widget) => {
      const html = renderToString(
        <WidgetPreviewCanvas
          widget={widget}
          symbolsGrid={dummyGrid}
          symbolSlices={testSlices}
          fontGrid={dummyGrid}
          mode="thumb"
        />
      );
      expect(html).toContain('<canvas');
    });
  });
});
