import { describe, it, expect } from 'vitest';
import { GifWriter } from 'omggif';
import {
  isGifBuffer,
  decodeGif,
  convertGifFramesToGrids,
  scaleRgbaNearestNeighbor,
} from '../gifDecoder';

function createTestGif(frames: { width: number; height: number; pixels: number[]; delay?: number; disposal?: number }[]): Uint8Array {
  const width = frames[0].width;
  const height = frames[0].height;
  const buf = new Uint8Array(4096);
  const gw = new GifWriter(buf, width, height, { loop: 0 });

  frames.forEach(f => {
    gw.addFrame(0, 0, f.width, f.height, f.pixels, {
      palette: [0x000000, 0xffffff],
      delay: f.delay ?? 10,
      disposal: f.disposal ?? 0,
    });
  });

  return buf.subarray(0, gw.end());
}

describe('gifDecoder', () => {
  it('correctly detects GIF magic bytes', () => {
    const validGif = createTestGif([
      { width: 2, height: 2, pixels: [0, 1, 1, 0] },
    ]);
    expect(isGifBuffer(validGif)).toBe(true);

    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(isGifBuffer(pngHeader)).toBe(false);

    const empty = new Uint8Array(2);
    expect(isGifBuffer(empty)).toBe(false);
  });

  it('decodes multi-frame GIF with correct timing and frame count', () => {
    const gifData = createTestGif([
      { width: 4, height: 4, pixels: [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0], delay: 15 },
      { width: 4, height: 4, pixels: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1], delay: 25 },
    ]);

    const decoded = decodeGif(gifData);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.frames.length).toBe(2);
    expect(decoded.frames[0].delayMs).toBe(150);
    expect(decoded.frames[1].delayMs).toBe(250);
    expect(decoded.durationMs).toBe(400);

    // Frame 0: pixel 0 is 0 (black -> [0,0,0,255]), pixel 1 is 1 (white -> [255,255,255,255])
    expect(decoded.frames[0].rgba[0]).toBe(0);
    expect(decoded.frames[0].rgba[4]).toBe(255);

    // Frame 1: pixel 0 is 1 (white), pixel 1 is 0 (black)
    expect(decoded.frames[1].rgba[0]).toBe(255);
    expect(decoded.frames[1].rgba[4]).toBe(0);
  });

  it('converts decoded GIF frames to BwpxGrid instances', () => {
    const gifData = createTestGif([
      { width: 2, height: 2, pixels: [1, 0, 0, 1], delay: 10 },
      { width: 2, height: 2, pixels: [0, 1, 1, 0], delay: 10 },
    ]);

    const decoded = decodeGif(gifData);
    const converted = convertGifFramesToGrids(decoded, {
      threshold: 128,
      invert: false,
    });

    expect(converted.length).toBe(2);
    expect(converted[0].grid.get(0, 0)).toBe(1);
    expect(converted[0].grid.get(1, 0)).toBe(0);
    expect(converted[1].grid.get(0, 0)).toBe(0);
    expect(converted[1].grid.get(1, 0)).toBe(1);
  });

  it('supports inverting frames during conversion', () => {
    const gifData = createTestGif([
      { width: 2, height: 2, pixels: [1, 0, 0, 1], delay: 10 },
    ]);

    const decoded = decodeGif(gifData);
    const inverted = convertGifFramesToGrids(decoded, {
      threshold: 128,
      invert: true,
    });

    expect(inverted[0].grid.get(0, 0)).toBe(0);
    expect(inverted[0].grid.get(1, 0)).toBe(1);
  });

  it('performs crisp nearest-neighbor scaling', () => {
    const src = new Uint8ClampedArray([
      255, 255, 255, 255,   0, 0, 0, 255,
      0, 0, 0, 255,         255, 255, 255, 255,
    ]); // 2x2 checkerboard

    const scaled = scaleRgbaNearestNeighbor(src, 2, 2, 4, 4);
    expect(scaled.length).toBe(4 * 4 * 4);

    // Top-left 2x2 should all be white (255)
    expect(scaled[0]).toBe(255);
    expect(scaled[4]).toBe(255);
    expect(scaled[16]).toBe(255);
    expect(scaled[20]).toBe(255);

    // Top-right 2x2 should all be black (0)
    expect(scaled[8]).toBe(0);
    expect(scaled[12]).toBe(0);
  });

  it('crops and scales sub-rectangle from frames', async () => {
    const { cropAndScaleRgbaNearestNeighbor } = await import('../gifDecoder');
    // 4x4 image:
    // row 0: [0, 0, 0, 0]
    // row 1: [0, 1, 1, 0]
    // row 2: [0, 1, 1, 0]
    // row 3: [0, 0, 0, 0]
    const gifData = createTestGif([
      {
        width: 4,
        height: 4,
        pixels: [
          0, 0, 0, 0,
          0, 1, 1, 0,
          0, 1, 1, 0,
          0, 0, 0, 0,
        ],
        delay: 10,
      },
    ]);

    const decoded = decodeGif(gifData);

    // Crop the central 2x2: x=1, y=1, w=2, h=2
    const converted = convertGifFramesToGrids(decoded, {
      threshold: 128,
      crop: { x: 1, y: 1, width: 2, height: 2 },
    });

    expect(converted.length).toBe(1);
    expect(converted[0].grid.width).toBe(2);
    expect(converted[0].grid.height).toBe(2);
    expect(converted[0].grid.get(0, 0)).toBe(1);
    expect(converted[0].grid.get(1, 0)).toBe(1);
    expect(converted[0].grid.get(0, 1)).toBe(1);
    expect(converted[0].grid.get(1, 1)).toBe(1);

    // Direct unit test of cropAndScaleRgbaNearestNeighbor
    const rawRgba = decoded.frames[0].rgba;
    const directCropped = cropAndScaleRgbaNearestNeighbor(rawRgba, 4, 4, 1, 1, 2, 2, 2, 2);
    expect(directCropped.length).toBe(2 * 2 * 4);
    // Pixel 0 is white
    expect(directCropped[0]).toBe(255);
  });
});
