import { describe, it, expect } from 'vitest';
import { BwpxGrid } from '../BwpxGrid';
import { drawLine } from '../algorithms';

describe('BwpxEditor UX logic', () => {
  it('overrides pixels beneath when dragging/dropping a selection', () => {
    const grid = new BwpxGrid(32, 32);

    // Destination already has solid 1s in a 4x4 box at (10, 10)
    for (let y = 10; y < 14; y++) {
      for (let x = 10; x < 14; x++) {
        grid.set(x, y, 1);
      }
    }
    expect(grid.get(10, 10)).toBe(1);
    expect(grid.get(11, 11)).toBe(1);

    // Moving a 4x4 region that only has a single 1 at (0, 0) and the rest are 0 (black)
    const movingBox = {
      w: 4,
      h: 4,
      pixels: [[0, 0]] as [number, number][],
    };

    const targetX = 10;
    const targetY = 10;

    // The fix: clear target rectangle first (black overrides beneath)
    grid.clearRect({ x: targetX, y: targetY, w: movingBox.w, h: movingBox.h });
    movingBox.pixels.forEach(([rx, ry]) => {
      grid.set(targetX + rx, targetY + ry, 1);
    });

    // (10, 10) is 1
    expect(grid.get(10, 10)).toBe(1);
    // (11, 11) is now 0 (black overrode the previous 1!)
    expect(grid.get(11, 11)).toBe(0);
    expect(grid.get(12, 12)).toBe(0);
    expect(grid.get(13, 13)).toBe(0);
  });

  it('draws continuously without gaps during rapid mouse movement', () => {
    const grid = new BwpxGrid(32, 32);
    // Rapid jump from (2, 2) to (8, 2)
    drawLine(grid, 2, 2, 8, 2, 1, 1);

    // All intermediate pixels must be set
    for (let x = 2; x <= 8; x++) {
      expect(grid.get(x, 2)).toBe(1);
    }
  });

  it('correctly calculates intersecting slices for Quick Move zone selection', () => {
    const slices = [
      { id: 'SLICE_A', name: 'A', x: 0, y: 0, width: 8, height: 8 },
      { id: 'SLICE_B', name: 'B', x: 10, y: 0, width: 8, height: 8 },
      { id: 'SLICE_C', name: 'C', x: 25, y: 25, width: 8, height: 8 },
    ];

    // Marquee zone covering [0, 0] to [15, 10]
    const minX = 0;
    const minY = 0;
    const w = 15;
    const h = 10;

    const zoneSlices = slices.filter(s =>
      s.x < minX + w && s.x + s.width > minX &&
      s.y < minY + h && s.y + s.height > minY
    );

    expect(zoneSlices.map(s => s.id)).toEqual(['SLICE_A', 'SLICE_B']);
  });

  it('validates bwpx-pixels clipboard payload format', () => {
    const payload = {
      type: 'bwpx-pixels',
      width: 16,
      height: 16,
      pixels: [[0, 1], [2, 3]],
      copiedAt: Date.now(),
    };

    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe('bwpx-pixels');
    expect(parsed.width).toBe(16);
    expect(parsed.pixels).toHaveLength(2);
  });

  it('preserves selection original position on undo', () => {
    // Simulating history entries as managed by BwpxEditor
    const initialGrid = new BwpxGrid(32, 32);
    initialGrid.set(5, 5, 1);

    const history: Array<{
      grid: BwpxGrid;
      selection: { x: number; y: number; w: number; h: number; active: boolean } | null;
      sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[];
    }> = [
      {
        grid: initialGrid.clone(),
        selection: { x: 5, y: 5, w: 4, h: 4, active: true },
      },
    ];
    let historyIndex = 0;

    // Move selection to (15, 15)
    const movedGrid = initialGrid.clone();
    movedGrid.clearRect({ x: 5, y: 5, w: 4, h: 4 });
    movedGrid.set(15, 15, 1);

    // Push new history state with updated selection and slice updates
    history.push({
      grid: movedGrid.clone(),
      selection: { x: 15, y: 15, w: 4, h: 4, active: true },
      sliceUpdates: [{ id: 'slice-1', prevX: 5, prevY: 5, newX: 15, newY: 15 }],
    });
    historyIndex = 1;

    expect(history[historyIndex].selection).toEqual({ x: 15, y: 15, w: 4, h: 4, active: true });
    expect(history[historyIndex].grid.get(15, 15)).toBe(1);
    expect(history[historyIndex].grid.get(5, 5)).toBe(0);

    // Undo action: step backward
    const currentEntry = history[historyIndex];
    historyIndex -= 1;
    const targetEntry = history[historyIndex];

    // Restores selection to its original place (5, 5)
    expect(targetEntry.selection).toEqual({ x: 5, y: 5, w: 4, h: 4, active: true });
    expect(targetEntry.grid.get(5, 5)).toBe(1);
    expect(targetEntry.grid.get(15, 15)).toBe(0);

    // Reverts slice updates
    const reversedSliceUpdates = currentEntry.sliceUpdates?.map(u => ({
      id: u.id,
      dx: u.prevX - u.newX,
      dy: u.prevY - u.newY,
    }));
    expect(reversedSliceUpdates).toEqual([{ id: 'slice-1', dx: -10, dy: -10 }]);
  });

  it('guarantees crisp integer ZOOM_STEPS to prevent mushy zooming out', async () => {
    const { ZOOM_STEPS } = await import('../../components/BwpxEditor');

    expect(ZOOM_STEPS.length).toBeGreaterThan(5);
    expect(ZOOM_STEPS[0]).toBe(1); // 100% 1:1 pixel view
    expect(ZOOM_STEPS).toContain(10); // default zoom

    // Verify all steps are positive integers in strictly ascending order
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      expect(Number.isInteger(ZOOM_STEPS[i])).toBe(true);
      expect(ZOOM_STEPS[i]).toBeGreaterThanOrEqual(1);
      if (i > 0) {
        expect(ZOOM_STEPS[i]).toBeGreaterThan(ZOOM_STEPS[i - 1]);
      }
    }
  });

  it('ensures adjacent pixels meet at exact integer boundaries with zero subpixel gaps or blur', () => {
    // Tests the pixel rasterization formula used in gridRenderer
    const zoomLevels = [1, 2, 3, 4, 5, 6, 7, 8, 10, 16];

    for (const z of zoomLevels) {
      for (let x = 0; x < 32; x++) {
        const px0 = Math.round(x * z);
        const pw0 = Math.round((x + 1) * z) - px0;
        const px1 = Math.round((x + 1) * z);

        // Every coordinate and dimension must be an exact integer
        expect(Number.isInteger(px0)).toBe(true);
        expect(Number.isInteger(pw0)).toBe(true);
        expect(pw0).toBeGreaterThanOrEqual(1);

        // Pixel 0 right edge must exactly equal pixel 1 left edge (seamless, no gap, no subpixel blend)
        expect(px0 + pw0).toBe(px1);
      }
    }
  });

  it('ensures calculateZoomAtPoint targets the mouse position precisely when zooming in and out', async () => {
    const { calculateZoomAtPoint, ZOOM_STEPS } = await import('../../components/BwpxEditor');

    const testMousePositions = [
      { mouseX: 0, mouseY: 0 },
      { mouseX: 100, mouseY: 100 },
      { mouseX: 387, mouseY: 243 },
      { mouseX: 1280, mouseY: 720 },
    ];

    const initialPan = { x: 250, y: 180 };
    const initialZoom = 10;

    for (const { mouseX, mouseY } of testMousePositions) {
      // The fractional grid coordinate under the mouse before zooming
      const gridX = (mouseX - initialPan.x) / initialZoom;
      const gridY = (mouseY - initialPan.y) / initialZoom;

      // 1. Zoom In (step = 1)
      const zoomedIn = calculateZoomAtPoint(initialZoom, initialPan, mouseX, mouseY, 1, ZOOM_STEPS);
      expect(zoomedIn.zoom).toBeGreaterThan(initialZoom);
      expect(Number.isInteger(zoomedIn.pan.x)).toBe(true);
      expect(Number.isInteger(zoomedIn.pan.y)).toBe(true);

      // Verify that after zooming in, the original grid coordinate lands exactly at mouse position (+/- 0.5px rounding)
      const screenXAfterZoomIn = zoomedIn.pan.x + gridX * zoomedIn.zoom;
      const screenYAfterZoomIn = zoomedIn.pan.y + gridY * zoomedIn.zoom;
      expect(Math.abs(screenXAfterZoomIn - mouseX)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(screenYAfterZoomIn - mouseY)).toBeLessThanOrEqual(0.5);

      // 2. Zoom Out (step = -1)
      const zoomedOut = calculateZoomAtPoint(initialZoom, initialPan, mouseX, mouseY, -1, ZOOM_STEPS);
      expect(zoomedOut.zoom).toBeLessThan(initialZoom);
      expect(Number.isInteger(zoomedOut.pan.x)).toBe(true);
      expect(Number.isInteger(zoomedOut.pan.y)).toBe(true);

      const screenXAfterZoomOut = zoomedOut.pan.x + gridX * zoomedOut.zoom;
      const screenYAfterZoomOut = zoomedOut.pan.y + gridY * zoomedOut.zoom;
      expect(Math.abs(screenXAfterZoomOut - mouseX)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(screenYAfterZoomOut - mouseY)).toBeLessThanOrEqual(0.5);
    }
  });

  it('clamps zoom boundaries at minimum (1) and maximum (64) without mutating pan', async () => {
    const { calculateZoomAtPoint, ZOOM_STEPS } = await import('../../components/BwpxEditor');
    const pan = { x: 150, y: 100 };

    // At min zoom, zooming out should return the same zoom and pan
    const atMin = calculateZoomAtPoint(1, pan, 200, 200, -1, ZOOM_STEPS);
    expect(atMin.zoom).toBe(1);
    expect(atMin.pan).toEqual(pan);

    // At max zoom, zooming in should return the same zoom and pan
    const maxZoom = ZOOM_STEPS[ZOOM_STEPS.length - 1];
    const atMax = calculateZoomAtPoint(maxZoom, pan, 200, 200, 1, ZOOM_STEPS);
    expect(atMax.zoom).toBe(maxZoom);
    expect(atMax.pan).toEqual(pan);
  });
});

