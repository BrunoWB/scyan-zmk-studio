import { describe, it } from 'vitest';
import { BwpxGrid } from '../BwpxGrid';
import { drawLine, drawRect, floodFill } from '../algorithms';
import { benchmark, printBenchmarkTable, type BenchmarkResult } from './benchUtil';

describe('BwpxGrid Core Operations Benchmark', () => {
  it('benchmarks BwpxGrid core queries and allocations', () => {
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
      benchmark('get(x,y) - 1,000 lookups', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += mediumGrid.get(i % 128, (i * 3) % 34);
        }
        return sum;
      })
    );

    results.push(
      benchmark('set(x,y,1) - 500 writes to new grid', () => {
        const grid = new BwpxGrid(128, 34);
        for (let i = 0; i < 500; i++) {
          grid.set(i % 128, (i * 3) % 34, 1);
        }
      })
    );

    results.push(
      benchmark('getAllPixels() - sparse (100 px)', () => {
        sparseGrid.getAllPixels();
      })
    );

    results.push(
      benchmark('getAllPixels() - medium (1,000 px)', () => {
        mediumGrid.getAllPixels();
      })
    );

    results.push(
      benchmark('getAllPixels() - dense (4,352 px)', () => {
        denseGrid.getAllPixels();
      })
    );

    results.push(
      benchmark('getBounds() - medium (1,000 px)', () => {
        mediumGrid.getBounds();
      })
    );

    results.push(
      benchmark('clone() - medium (1,000 px)', () => {
        mediumGrid.clone();
      })
    );

    results.push(
      benchmark('to1bppBytes() - 128x34 grid', () => {
        mediumGrid.to1bppBytes();
      })
    );

    printBenchmarkTable('BwpxGrid Core Operations', results);
  });
});

describe('Bwpx Drawing Algorithms Benchmark', () => {
  it('benchmarks drawing primitives and fills', () => {
    const results: BenchmarkResult[] = [];

    results.push(
      benchmark('drawLine - 50px continuous stroke', () => {
        const grid = new BwpxGrid(128, 34);
        drawLine(grid, 5, 5, 55, 30, 1, 1);
      })
    );

    results.push(
      benchmark('drawRect - 30x30 filled rectangle', () => {
        const grid = new BwpxGrid(128, 34);
        drawRect(grid, 2, 2, 32, 32, 1, true, 1);
      })
    );

    results.push(
      benchmark('floodFill - 30x30 bounded area', () => {
        const grid = new BwpxGrid(128, 34);
        drawRect(grid, 0, 0, 30, 30, 1, false, 1);
        floodFill(grid, 15, 15, 1);
      })
    );

    printBenchmarkTable('Bwpx Drawing Algorithms', results);
  });
});
