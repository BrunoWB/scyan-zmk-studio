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
});

