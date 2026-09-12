import { describe, it } from 'vitest';
import { BwpxGrid } from '../BwpxGrid';
import { renderBwpxCanvas } from '../gridRenderer';
import { benchmark, printBenchmarkTable, type BenchmarkResult } from './benchUtil';

function createFastMockCanvas(width = 800, height = 600) {
  const canvas = { width, height } as HTMLCanvasElement;
  let currentFillStyle = '';
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: false,
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val: string) {
      currentFillStyle = val;
    },
    strokeStyle: '',
    lineWidth: 1,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    fill: noop,
    setLineDash: noop,
    fillText: noop,
    measureText: () => ({ width: 50 }),
  } as unknown as CanvasRenderingContext2D;

  return { canvas, ctx };
}

describe('gridRenderer Canvas Pipeline Benchmark', () => {
  it('benchmarks canvas rendering passes across densities and zoom levels', () => {
    const { canvas, ctx } = createFastMockCanvas();
    const results: BenchmarkResult[] = [];

    const sparseGrid = new BwpxGrid(128, 34);
    for (let i = 0; i < 100; i++) {
      sparseGrid.set((i * 7) % 128, (i * 13) % 34, 1);
    }

    const mediumGrid = new BwpxGrid(128, 34);
    for (let i = 0; i < 1000; i++) {
      mediumGrid.set((i * 17) % 128, (i * 23) % 34, 1);
    }

    const denseGrid = new BwpxGrid(128, 34);
    for (let y = 0; y < 34; y++) {
      for (let x = 0; x < 128; x++) {
        denseGrid.set(x, y, 1);
      }
    }

    results.push(
      benchmark('renderBwpxCanvas - sparse (100 px, zoom 10)', () => {
        renderBwpxCanvas(canvas, ctx, {
          grid: sparseGrid,
          zoom: 10,
          pan: { x: 50, y: 50 },
          showAxes: true,
          showGridLines: true,
          hoverPos: { x: 10, y: 10 },
        });
      })
    );

    results.push(
      benchmark('renderBwpxCanvas - medium (1,000 px, zoom 10)', () => {
        renderBwpxCanvas(canvas, ctx, {
          grid: mediumGrid,
          zoom: 10,
          pan: { x: 50, y: 50 },
          showAxes: true,
          showGridLines: true,
          hoverPos: { x: 10, y: 10 },
        });
      })
    );

    results.push(
      benchmark('renderBwpxCanvas - dense (4,352 px, zoom 10)', () => {
        renderBwpxCanvas(canvas, ctx, {
          grid: denseGrid,
          zoom: 10,
          pan: { x: 50, y: 50 },
          showAxes: true,
          showGridLines: true,
          hoverPos: { x: 10, y: 10 },
        });
      })
    );

    results.push(
      benchmark('renderBwpxCanvas - 1:1 view (1,000 px, zoom 1)', () => {
        renderBwpxCanvas(canvas, ctx, {
          grid: mediumGrid,
          zoom: 1,
          pan: { x: 0, y: 0 },
          showAxes: false,
          showGridLines: false,
        });
      })
    );

    results.push(
      benchmark('renderBwpxCanvas - panning (medium grid, 10 frames)', () => {
        for (let offset = 0; offset < 10; offset++) {
          renderBwpxCanvas(canvas, ctx, {
            grid: mediumGrid,
            zoom: 10,
            pan: { x: 50 + offset * 2, y: 50 + offset * 2 },
            showAxes: true,
            showGridLines: true,
          });
        }
      })
    );

    const fontAtlasSlices = Array.from({ length: 150 }, (_, i) => ({
      id: `glyph_${i}`,
      name: `öÕ (B)`,
      groupId: `group_${i}`,
      groupOrder: 1,
      x: (i % 15) * 20,
      y: Math.floor(i / 15) * 25,
      width: 16,
      height: 16,
      color: '#c084fc',
    }));

    results.push(
      benchmark('renderBwpxCanvas - font atlas (150 slices, zoom 16, zoomed-in view)', () => {
        renderBwpxCanvas(canvas, ctx, {
          grid: mediumGrid,
          zoom: 16,
          pan: { x: -500, y: -400 },
          showAxes: true,
          showGridLines: true,
          slices: fontAtlasSlices,
        });
      })
    );

    printBenchmarkTable('gridRenderer Canvas Pipeline', results);
  });
});
