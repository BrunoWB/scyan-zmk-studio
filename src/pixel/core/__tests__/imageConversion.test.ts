import { describe, it, expect } from 'vitest';
import { convertImageDataToGrid } from '../imageConversion';

describe('imageConversion', () => {
  it('converts pixels above threshold to 1 and below to 0', () => {
    // 2x2 image:
    // (0,0): Black (0,0,0) -> 0
    // (1,0): Gray (100,100,100) -> 0 (with threshold 128)
    // (0,1): Light gray (150,150,150) -> 1 (with threshold 128)
    // (1,1): White (255,255,255) -> 1
    const width = 2;
    const height = 2;
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,       // (0,0) black
      100, 100, 100, 255, // (1,0) dark gray
      150, 150, 150, 255, // (0,1) light gray
      255, 255, 255, 255, // (1,1) white
    ]);

    const fakeImageData = { width, height, data } as ImageData;

    const grid = convertImageDataToGrid(fakeImageData, { threshold: 128, invert: false });
    expect(grid.get(0, 0)).toBe(0);
    expect(grid.get(1, 0)).toBe(0);
    expect(grid.get(0, 1)).toBe(1);
    expect(grid.get(1, 1)).toBe(1);
    expect(grid.countOn()).toBe(2);
  });

  it('inverts pixels when invert: true', () => {
    const width = 2;
    const height = 1;
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,       // (0,0) black
      255, 255, 255, 255, // (1,0) white
    ]);

    const fakeImageData = { width, height, data } as ImageData;

    const grid = convertImageDataToGrid(fakeImageData, { threshold: 128, invert: true });
    // Inverted: black becomes 1, white becomes 0
    expect(grid.get(0, 0)).toBe(1);
    expect(grid.get(1, 0)).toBe(0);
  });

  it('treats transparent pixels (alpha < 64) as off', () => {
    const width = 2;
    const height = 1;
    const data = new Uint8ClampedArray([
      255, 255, 255, 0,   // (0,0) fully transparent white
      255, 255, 255, 255, // (1,0) opaque white
    ]);

    const fakeImageData = { width, height, data } as ImageData;

    const grid = convertImageDataToGrid(fakeImageData, { threshold: 128, invert: false });
    expect(grid.get(0, 0)).toBe(0);
    expect(grid.get(1, 0)).toBe(1);
  });

  it('adjusts with different threshold values', () => {
    const width = 1;
    const height = 1;
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const fakeImageData = { width, height, data } as ImageData;

    // At threshold 50, luminance ~100 >= 50 => on (1)
    const gridLow = convertImageDataToGrid(fakeImageData, { threshold: 50 });
    expect(gridLow.get(0, 0)).toBe(1);

    // At threshold 150, luminance ~100 < 150 => off (0)
    const gridHigh = convertImageDataToGrid(fakeImageData, { threshold: 150 });
    expect(gridHigh.get(0, 0)).toBe(0);
  });
});

